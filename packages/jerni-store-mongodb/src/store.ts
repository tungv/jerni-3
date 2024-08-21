import { setTimeout } from "node:timers/promises";
import { type Collection, type Db, type Document, MongoClient } from "mongodb";
import makeTestLogger from "../tests/helpers/makeTestLogger";
import getCollectionName from "./getCollectionName";
import type MongoDBModel from "./model";
import getBulkOperations from "./optimistic/getBulkOperations";
import { Signal, clearModelSlots, runWithModel } from "./read";
import type { Changes, JourneyCommittedEvent, MongoDBStore, MongoDBStoreConfig, MongoOps } from "./types";

interface SnapshotDocument {
  __v: number;
  full_collection_name: string;
}

const defaultLogger = console;
const testLogger = makeTestLogger();

export default async function makeMongoDBStore(config: MongoDBStoreConfig): Promise<MongoDBStore> {
  const { url, dbName } = config;
  let connCount = 0;
  let conn: MongoClient | null = null;

  let lastSuccessfulEventId = 0;

  async function runDb<T>(cb: (client: MongoClient, db: Db) => Promise<T> | T) {
    connCount++;
    // logger.debug("connCount", connCount);

    if (!conn) {
      // first connection
      // logger.debug("connecting to mongodb");
      conn = new MongoClient(url);
      conn.connect();
    }

    const db = conn.db(dbName);

    try {
      return await cb(conn, db);
    } finally {
      connCount--;

      if (connCount === 0) {
        // logger.debug("schedule to close mongodb connection");
        setTimeout(1000).then(async () => {
          if (connCount === 0 && conn) {
            // logger.debug("closing mongodb connection");
            await conn.close();
            conn = null;
          }
        });
      }
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

  async function handleEvents(
    events: JourneyCommittedEvent[],
    signal?: AbortSignal,
  ): Promise<{ [modelIdentifier: string]: Changes }> {
    const changes = models.map(() => ({
      added: 0,
      updated: 0,
      deleted: 0,
    }));

    const recursiveSignal = signal ?? AbortSignal.timeout(60_000);

    await runDb((_, db) => handleEventsRecursive(db, events, changes, recursiveSignal));

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

  async function handleEventsRecursive(
    db: Db,
    events: JourneyCommittedEvent[],
    changes: Changes[],
    abortSignal: AbortSignal,
  ) {
    if (abortSignal.aborted) {
      return;
    }

    let interruptedIndex = -1;
    const signals: Signal<Document>[] = [];

    const outputs = events.map((event, index) => {
      if (interruptedIndex !== -1) {
        return [];
      }

      // skip events that have been processed
      if (event.id <= lastSuccessfulEventId) {
        return [];
      }

      // return [];

      const out = models.map((model) => {
        try {
          return runWithModel(model, event);
        } catch (error) {
          if (error instanceof Signal) {
            // logger.debug(
            //   "event id=%d, type=%s reads. Stop and processing previous event (from %d to before %d)",
            //   event.id,
            //   event.type,
            //   events[0].id,
            //   events[index].id,
            // );

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

    // output is an array of changes per event.
    // however for efficiency, we need to handle event per model
    type VersionedChange = {
      change: MongoOps<Document>;
      __op: number;
      __v: number;
    };

    const changesPerModel: VersionedChange[][] = [];

    for (const allChangesForAnEvent of outputs) {
      let modelIndex = 0;
      for (const changesForAModel of allChangesForAnEvent) {
        let __op = 0;

        if (changesForAModel === undefined || changesForAModel.length === 0) {
          modelIndex++;
          continue;
        }

        const changesWithOp = changesForAModel.map((change) => {
          return {
            change,
            __op: __op++,
            __v: events[eventIndex].id,
          };
        });

        // add changes to changesPerModel
        if (!changesPerModel[modelIndex]) {
          changesPerModel[modelIndex] = [];
        }
        changesPerModel[modelIndex].push(...changesWithOp);
        modelIndex++;
      }
      eventIndex++;
    }

    let modelIndex = 0;
    for (const changesForAModel of changesPerModel) {
      if (changesForAModel === undefined || changesForAModel.length === 0) {
        modelIndex++;
        continue;
      }

      const model = models[modelIndex];
      const outputForThisModel = changes[modelIndex];
      modelIndex++;
      const collection = db.collection(getCollectionName(model));

      const bulkWriteOperations = getBulkOperations(changesForAModel);

      const res = await collection.bulkWrite(bulkWriteOperations, { ordered: true });
      // const res = {
      //   upsertedCount: 0,
      //   modifiedCount: 0,
      //   deletedCount: 0,
      // };

      // check if the operation is interrupted
      if (abortSignal.aborted) {
        return;
      }

      outputForThisModel.added += res.upsertedCount;
      outputForThisModel.updated += res.modifiedCount;
      outputForThisModel.deleted += res.deletedCount;
    }

    // if the first event is interrupted, we do NOT need to update the snapshot collection
    if (interruptedIndex !== 0 && !abortSignal.aborted) {
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

      lastSuccessfulEventId = lastSeenId;
    }

    // continue with remaining events
    if (interruptedIndex !== -1) {
      const remainingEvents = events.slice(interruptedIndex);

      // execute signals
      for (const signal of signals) {
        if (abortSignal.aborted) {
          return;
        }
        await signal.execute(db);
      }

      // if the signal is thrown by the last event, no need to continue
      if (remainingEvents.length === 0) {
        return;
      }

      await handleEventsRecursive(db, remainingEvents, changes, abortSignal);
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
      lastSuccessfulEventId = 0;
    });
  }

  async function dispose() {
    hasStopped = true;
    // close connections
    // await client.close();
  }
}
