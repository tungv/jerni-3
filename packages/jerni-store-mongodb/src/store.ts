import { setTimeout } from "node:timers/promises";
import { type Collection, type Db, type Document, MongoClient } from "mongodb";
import makeTestLogger from "../tests/helpers/makeTestLogger";
import getCollectionName from "./getCollectionName";
import type MongoDBModel from "./model";
import getBulkOperations from "./optimistic/getBulkOperations";
import { Signal, clearModelSlots, runWithModel } from "./read";
import type { Changes, JourneyCommittedEvent, MongoDBStore, MongoDBStoreConfig } from "./types";

interface SnapshotDocument {
  __v: number;
  full_collection_name: string;
}

const defaultLogger = console;
const testLogger = makeTestLogger();

export default async function makeMongoDBStore(config: MongoDBStoreConfig): Promise<MongoDBStore> {
  const { url, dbName } = config;

  async function runDb<T>(cb: (client: MongoClient, db: Db) => Promise<T> | T) {
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbName);

    try {
      return await cb(client, db);
    } finally {
      await client.close();
    }
  }

  async function getCollection() {
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbName);

    return [client, db] as const;
  }

  let hasStopped = false;

  const models = config.models;

  // use test logger if NODE_ENV is test
  const logger = process.env.NODE_ENV === "test" ? testLogger : config.logger || defaultLogger;

  await runDb(async (_, db) => {
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
  });

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

  async function getDriver<T extends Document>(model: MongoDBModel<T>): Promise<Collection<T> & AsyncDisposable> {
    const [client, db] = await getCollection();
    const collection = db.collection<T>(getCollectionName(model));

    // add [Symbol.asyncDispose] to the return value
    // so that the driver can be disposed by the caller
    // when it's no longer needed
    const disposable = Object.assign(collection, {
      [Symbol.asyncDispose]: async () => {
        await client.close();
      },
    });

    return disposable;
  }

  async function handleEvents(events: JourneyCommittedEvent[]): Promise<{ [modelIdentifier: string]: Changes }> {
    const changes = models.map(() => ({
      added: 0,
      updated: 0,
      deleted: 0,
    }));

    await runDb((_, db) => handleEventsRecursive(db, events, changes));

    return Object.fromEntries(
      models.flatMap((model, modelIndex) => {
        if (!changes[modelIndex]) {
          return [];
        }
        if (changes[modelIndex].added === 0 && changes[modelIndex].updated === 0 && changes[modelIndex].deleted === 0) {
          return [];
        }

        return [[`${model.name}_v${model.version}`, changes[modelIndex] ?? { added: 0, updated: 0, deleted: 0 }]];
      }),
    );
  }

  async function handleEventsRecursive(db: Db, events: JourneyCommittedEvent[], changes: Changes[]) {
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
              "event id=%d, type=%s reads. Stop and processing previous event (from %d to before %d)",
              event.id,
              event.type,
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
        const collection = db.collection(getCollectionName(model));

        const bulkWriteOperations = getBulkOperations(changesWithOp);

        const res = await collection.bulkWrite(bulkWriteOperations, { ordered: true });

        changesForThisModel.added += res.upsertedCount;
        changesForThisModel.updated += res.modifiedCount;
        changesForThisModel.deleted += res.deletedCount;
      }
      eventIndex++;
    }

    // if the first event is interrupted, we do NOT need to update the snapshot collection
    if (interruptedIndex !== 0) {
      // the last seen id of snapshot should be the interrupted index -1 or the last event id if no interruption
      const lastSeenId = interruptedIndex === -1 ? events[events.length - 1].id : events[interruptedIndex - 1].id;
      const snapshotCollection = db.collection<SnapshotDocument>("jerni__snapshot");
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
    }

    // continue with remaining events
    if (interruptedIndex !== -1) {
      const remainingEvents = events.slice(interruptedIndex);

      // execute signals
      for (const signal of signals) {
        await signal.execute(db);
      }

      // if the signal is thrown by the last event, no need to continue
      if (remainingEvents.length === 0) {
        return;
      }

      await handleEventsRecursive(db, remainingEvents, changes);
    }
  }

  async function getLastSeenId() {
    return await runDb(async (_, db) => {
      const snapshotCollection = db.collection<SnapshotDocument>("jerni__snapshot");

      const registeredModels = await snapshotCollection
        .find({
          full_collection_name: { $in: models.map(getCollectionName) },
        })
        .toArray();

      if (registeredModels.length === 0) return 0;

      return Math.max(0, Math.min(...registeredModels.map((doc) => doc.__v)));
    });
  }

  async function clean() {
    await runDb(async (_, db) => {
      // delete mongodb collections
      for (const model of models) {
        try {
          const collection = db.collection(getCollectionName(model));
          await collection.drop();
        } catch (ex) {
          // ignore
        }
      }

      // delete rows in snapshot collection

      const snapshotCollection = db.collection<SnapshotDocument>("jerni__snapshot");
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
    });
  }

  async function dispose() {
    hasStopped = true;
    // close connections
    // await client.close();
  }
}
