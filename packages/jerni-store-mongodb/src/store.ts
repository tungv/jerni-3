import { type Collection, type Document, MongoClient } from "mongodb";
import getCollectionName from "./getCollectionName";
import type MongoDBModel from "./model";
import getBulkOperations from "./optimistic/getBulkOperations";
import { clearModelSlots, runWithModel, Signal } from "./read";
import type { JourneyCommittedEvent, MongoDBStoreConfig, MongoDBStore, Changes } from "./types";
import { setTimeout } from "node:timers/promises";

interface SnapshotDocument {
  __v: number;
  full_collection_name: string;
}

function addDependenciesToModels(model: MongoDBModel<Document>, models: MongoDBModel<Document>[]) {
  const dependencies = model.dependencies || [];
  for (const dependency of dependencies) {
    if (!models.includes(dependency)) {
      models.push(dependency);
      addDependenciesToModels(dependency, models);
    }
  }
}

const defaultLogger = console;

export default async function makeMongoDBStore(config: MongoDBStoreConfig): Promise<MongoDBStore> {
  const logger = config.logger || defaultLogger;

  const client = await MongoClient.connect(config.url);
  const db = client.db(config.dbName);
  let hasStopped = false;

  const models = config.models;

  // add all dependency models to the list
  for (const model of models) {
    addDependenciesToModels(model, models);
  }

  const snapshotCollection = db.collection<SnapshotDocument>("jerni__snapshot");

  // ensure snapshot collection
  for (const model of models) {
    const fullCollectionName = getCollectionName(model);
    await snapshotCollection.updateOne(
      {
        full_collection_name: fullCollectionName,
      },
      {
        $setOnInsert: {
          __v: 0,
          full_collection_name: fullCollectionName,
        },
      },
      {
        upsert: true,
      },
    );
  }

  // get all the versions of the models
  const allSnapshots = await snapshotCollection
    .find({
      full_collection_name: { $in: models.map(getCollectionName) },
    })
    .toArray();

  const versions = allSnapshots.map((doc) => ({
    name: doc.full_collection_name,
    version: doc.__v,
  }));

  // get the not up-to-date models by comparing them with the latest version
  const latestVersion = versions.reduce(
    (acc, doc) => {
      if (doc.version > acc.version) {
        return doc;
      }

      return acc;
    },
    {
      name: "",
      version: 0,
    },
  );

  const notUpToDateModels = models.filter((model) => {
    const collectionName = getCollectionName(model);
    const version = versions.find((doc) => doc.name === collectionName);

    // this should never happen since we have upserted all models
    if (!version) {
      throw new Error(`snapshot for ${collectionName} not found`);
    }

    return version.version < latestVersion.version;
  });

  // for all not up-to-date models, we need to drop their dependent collections
  while (true) {
    const model = notUpToDateModels.shift();

    // need to check condition here because type of shift() is always T | undefined
    if (!model) {
      break;
    }

    const dependencies = model.dependencies || [];
    if (dependencies.length > 0) {
      logger.debug(
        `detected model ${model.name} is not up-to-date, dropping ${dependencies.length} dependencies: ${dependencies
          .map((d) => d.name)
          .join(", ")}`,
      );
    }

    for (const dependency of dependencies) {
      const dependencyCollectionName = getCollectionName(dependency);
      const version = versions.find((doc) => doc.name === dependencyCollectionName);

      // this should never happen since we have upserted for all models and its dependencies
      if (!version) {
        throw new Error(`snapshot for ${dependencyCollectionName} not found`);
      }

      // if the dependency is already dropped, we can skip it
      if (version.version === 0) {
        continue;
      }

      // if the dependency is not dropped yet, we need to drop it
      await snapshotCollection.updateOne(
        {
          full_collection_name: dependencyCollectionName,
        },
        {
          $set: {
            __v: 0,
          },
        },
      );

      const collection = db.collection(dependencyCollectionName);
      await collection.drop();

      // optimistic update the version
      version.version = 0;

      // then add it to the notUpToDateModels to check for its dependencies
      notUpToDateModels.push(dependency);
    }
  }

  async function* listen() {
    while (!hasStopped) {
      const next = await getLastSeenId();
      yield next;
      await setTimeout(300);
    }
  }

  const store: MongoDBStore = {
    name: config.name,
    meta: {
      includes: [],
    },
    registerModels,
    getDriver,
    handleEvents,
    getLastSeenId,
    clean,
    dispose,
    listen,
    toString() {
      return `[@jerni/store-mongodb] - name: ${config.name} - URL: ${config.url} - DB: ${config.dbName}`;
    },
  };

  return store;

  function registerModels(
    map: Map<
      {
        name: string;
        version: string;
      },
      MongoDBStore
    >,
  ) {
    const includes = new Set<string>();
    let includesAll = false;

    for (const model of models) {
      map.set(model, store);

      // handle meta.includes
      const modelSpecificMeta = model.meta || model.transform.meta;
      if (!modelSpecificMeta || !modelSpecificMeta.includes || modelSpecificMeta.includes.length === 0) {
        includesAll = true;
        continue;
      }

      for (const type of modelSpecificMeta.includes) {
        includes.add(type);
      }
    }

    if (includesAll) {
      store.meta.includes = [];
    } else {
      store.meta.includes = [...Array.from(includes)].sort((a, z) => a.localeCompare(z));
    }
  }

  function getDriver<T extends Document>(model: MongoDBModel<T>): Collection<T> {
    return db.collection(getCollectionName(model));
  }

  async function handleEvents(events: JourneyCommittedEvent[]): Promise<{ [modelIdentifier: string]: Changes }> {
    const changes = models.map(() => ({
      added: 0,
      updated: 0,
      deleted: 0,
    }));
    await handleEventsRecursive(events, changes);

    return Object.fromEntries(
      models.map((model, modelIndex) => {
        return [`${model.name}_v${model.version}`, changes[modelIndex] ?? { added: 0, updated: 0, deleted: 0 }];
      }),
    );
  }

  async function handleEventsRecursive(events: JourneyCommittedEvent[], changes: Changes[]) {
    let interruptedIndex = -1;
    const signals: Signal<Document>[] = [];

    const outputs = events.map((event, index) => {
      if (interruptedIndex !== -1) {
        return [];
      }

      const out = models.map((model) => {
        try {
          return runWithModel(model, event);
        } catch (error) {
          if (error instanceof Signal) {
            logger.debug(
              "event id=%d reads. Stop and processing previous event (from %d to before %d)",
              event.id,
              events[0].id,
              events[index].id,
            );

            interruptedIndex = index;

            signals.push(error);
            return [];
          }

          throw error;
        }
      });

      // the first event in the batch is the only event that needs to read from the cached signals
      // if no more signal created, the model slots should be cleared so that later event does not read outdated signals
      if (index === 0 && signals.length === 0) {
        clearModelSlots();
      }

      // if there are interrupted signals in this event, do not return output of the event
      if (interruptedIndex !== -1) {
        return [];
      }

      return out;
    });

    let eventIndex = 0;

    for (const allChangesForAnEvent of outputs) {
      let modelIndex = 0;
      for (const changesForAModel of allChangesForAnEvent) {
        let __op = 0;
        const model = models[modelIndex];
        const changesForThisModel = changes[modelIndex];
        modelIndex++;
        if (changesForAModel === undefined || changesForAModel.length === 0) {
          continue;
        }

        const changesWithOp = changesForAModel.map((change) => {
          return {
            change,
            __op: __op++,
            __v: events[eventIndex].id,
          };
        });
        const collection = getDriver(model);

        const bulkWriteOperations = getBulkOperations(changesWithOp);

        const res = await collection.bulkWrite(bulkWriteOperations);

        changesForThisModel.added += res.upsertedCount;
        changesForThisModel.updated += res.modifiedCount;
        changesForThisModel.deleted += res.deletedCount;
      }
      eventIndex++;
    }

    // update snapshot collections
    const lastSeenId = events[events.length - 1].id;
    await snapshotCollection.updateMany(
      {
        full_collection_name: { $in: models.map(getCollectionName) },
      },
      {
        $set: {
          __v: lastSeenId,
        },
      },
    );

    // continue with remaining events
    if (interruptedIndex !== -1) {
      const interruptedEvent = events[interruptedIndex];
      const remainingEvents = events.slice(interruptedIndex);

      logger.debug(
        "priming data for event:\n%s",
        require("node:util").inspect(interruptedEvent, { depth: null, colors: true }),
      );

      // execute signals
      for (const signal of signals) {
        await signal.execute(db);
      }

      await handleEventsRecursive(remainingEvents, changes);
    }
  }

  async function getLastSeenId() {
    const snapshotCollection = db.collection<SnapshotDocument>("jerni__snapshot");

    const registeredModels = await snapshotCollection
      .find({
        full_collection_name: { $in: models.map(getCollectionName) },
      })
      .toArray();

    if (registeredModels.length === 0) return 0;

    return Math.max(0, Math.min(...registeredModels.map((doc) => doc.__v)));
  }

  async function clean() {
    // delete mongodb collections
    for (const model of models) {
      try {
        const collection = getDriver(model);
        await collection.drop();
      } catch (ex) {
        // ignore
      }
    }

    // delete rows in snapshot collection
    await snapshotCollection.updateMany(
      {
        full_collection_name: { $in: models.map(getCollectionName) },
      },
      {
        $set: {
          __v: 0,
        },
      },
    );
  }

  async function dispose() {
    hasStopped = true;
    // close connections
    await client.close();
  }
}
