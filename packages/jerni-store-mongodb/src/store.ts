import { setTimeout } from "node:timers/promises";
import { type AnyBulkWriteOperation, type Collection, type Db, type Document, MongoClient } from "mongodb";
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

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * Maximum time (in milliseconds) to keep a MongoDB client connection before automatically releasing it.
       * If not specified, defaults to 5 minutes (300000ms).
       */
      JERNI_STORE_MONGODB_MAX_SHARED_CLIENT_TIMEOUT?: string;
    }
  }
}

const providedMaxSharedClientTimeout = process.env.JERNI_STORE_MONGODB_MAX_SHARED_CLIENT_TIMEOUT;
const DEFAULT_MAX_SHARED_CLIENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const MAX_SHARED_CLIENT_TIMEOUT = providedMaxSharedClientTimeout
  ? Number.parseInt(providedMaxSharedClientTimeout, 10)
  : DEFAULT_MAX_SHARED_CLIENT_TIMEOUT;

export default async function makeMongoDBStore(config: MongoDBStoreConfig): Promise<MongoDBStore> {
  const { url, dbName } = config;
  let connCount = 0;
  let conn: MongoClient | null = null;

  let lastSuccessfulEventId = 0;

  type ConnectionInfo = {
    createdAt: number;
    stack: string;
  };
  const connectionInfoMap = new Map<number, ConnectionInfo>();
  let connectionId = 0;

  async function getSharedClient(forceRelease: boolean) {
    connCount++;
    const currentId = connectionId++;

    if (!conn) {
      conn = new MongoClient(url);
      await conn.connect();
    }

    const info = {
      createdAt: Date.now(),
      stack: new Error().stack || "No stack trace available",
    };
    connectionInfoMap.set(currentId, info);

    if (forceRelease) {
      setTimeout(MAX_SHARED_CLIENT_TIMEOUT).then(() => {
        const info = connectionInfoMap.get(currentId);
        if (!info) return;

        const timeOpen = (Date.now() - info.createdAt) / 1000;
        logger.warn(
          `MongoDB connection was not properly released after ${timeOpen.toFixed(
            1,
          )}s. This may indicate a missing await on dispose() or using .dispose() instead of .asyncDispose. Connection was created at:\n${
            info.stack
          }`,
        );

        releaseSharedClient(currentId);
      });
    }

    return { client: conn, id: currentId };
  }

  async function releaseSharedClient(id: number) {
    connectionInfoMap.delete(id);
    connCount--;

    if (connCount === 0) {
      setTimeout(1000).then(async () => {
        if (connCount === 0 && conn) {
          await conn.close();
          conn = null;
        }
      });
    }
  }

  async function runDb<T>(cb: (client: MongoClient, db: Db) => Promise<T> | T) {
    const { client, id } = await getSharedClient(false);
    const db = client.db(dbName);

    try {
      return await cb(client, db);
    } finally {
      await releaseSharedClient(id);
    }
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
    isSafeForDev,
    toString() {
      return `[@jerni/store-mongodb] - name: ${config.name} - URL: ${config.url} - DB: ${config.dbName}`;
    },
  };

  return store;

  async function isSafeForDev(): Promise<boolean> {
    // check if database name is prefixed with these
    const checkDbNamePrefixPassed = ["dev__", "local__", "test__"].some((prefix) => dbName.startsWith(prefix));
    // if dbName's prefix passed, it's safe for dev
    if (!checkDbNamePrefixPassed) {
      logger.error(
        `[@jerni/store-mongodb] Database name must be prefixed with "dev__", "local__", or "test__" to mark as safe for development. Your database name is "${dbName}".`,
      );
    }
    return checkDbNamePrefixPassed;
  }

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
    const { client, id } = await getSharedClient(true);
    const collection = client.db(dbName).collection<T>(getCollectionName(model));

    const disposable = Object.assign(collection, {
      [Symbol.asyncDispose]: async () => {
        await releaseSharedClient(id);
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
    const skipByModel = models.map(() => lastSuccessfulEventId);

    await runDb(async (_, db) => {
      for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
        const model = models[modelIndex];
        const coll = db.collection<{ __v: number }>(getCollectionName(model));
        // find the max event id that has been processed for each model
        const doc = await coll.findOne(
          {
            __v: { $gt: lastSuccessfulEventId },
          },
          {
            projection: {
              __v: 1,
            },
            sort: {
              __v: -1,
            },
          },
        );

        if (doc) {
          skipByModel[modelIndex] = Math.max(skipByModel[modelIndex], Math.max(lastSuccessfulEventId, doc.__v - 1));
        }
      }

      await handleEventsRecursive(db, events, 0, events.length, skipByModel, changes, recursiveSignal);
    });

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
    completed: number,
    total: number,
    skipByModel: number[],
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
        if (event.id <= skipByModel[models.indexOf(model)]) {
          return [];
        }
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
    // so we need to group changes per model
    const bulkWritesPerModel: AnyBulkWriteOperation<Document>[][] = [];

    for (const allChangesForAnEvent of outputs) {
      let modelIndex = 0;
      for (const changesForAModel of allChangesForAnEvent) {
        if (changesForAModel === undefined || changesForAModel.length === 0) {
          modelIndex++;
          continue;
        }

        const changesWithOp = changesForAModel.map((change) => {
          return {
            change,
            __v: events[eventIndex].id,
          };
        });

        const operations = getBulkOperations(changesWithOp);

        // add operations to the bulkWritesPerModel
        if (!bulkWritesPerModel[modelIndex]) {
          bulkWritesPerModel[modelIndex] = [];
        }
        bulkWritesPerModel[modelIndex].push(...operations);
        modelIndex++;
      }
      eventIndex++;
    }

    await Promise.all(
      bulkWritesPerModel.map(async (bulkWritesForAModel, modelIndex) => {
        const model = models[modelIndex];
        const outputForThisModel = changes[modelIndex];
        if (bulkWritesForAModel === undefined || bulkWritesForAModel.length === 0) {
          return;
        }

        const collection = db.collection(getCollectionName(model));

        if (abortSignal.aborted) {
          return;
        }

        const res = await collection.bulkWrite(bulkWritesForAModel, { ordered: true, writeConcern: { w: "majority" } });

        skipByModel[modelIndex] = Math.max(skipByModel[modelIndex], events[events.length - 1].id);

        if (abortSignal.aborted) {
          logger.debug(
            `This batch of ${total} events is cancelled. ${completed} events are fully processed. Last fully processed event is #${skipByModel[0]}`,
          );
          logger.debug(
            `However, with collection=${collection.collectionName} we still optimistically skip the transformed output of events up to #${skipByModel[modelIndex]} in the following batches`,
          );
          return;
        }

        outputForThisModel.added += res.upsertedCount;
        outputForThisModel.updated += res.modifiedCount;
        outputForThisModel.deleted += res.deletedCount;
      }),
    );

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
      // logger.log(`continue from #${remainingEvents[0].id}`);

      for (let i = 0; i < skipByModel.length; i++) {
        skipByModel[i] = remainingEvents[0].id - 1;
      }

      const lastSuccessfulEventId = events.at(interruptedIndex)?.id;

      // execute signals
      for (const signal of signals) {
        if (abortSignal.aborted) {
          return;
        }
        await signal.execute(db);
      }

      // if the signal is thrown by the last event, no need to continue
      if (remainingEvents.length === 0) {
        logger.info(`processed: ${getProgressBar(total)} #${lastSuccessfulEventId}`);
        return;
      }

      logger.info(`processed: ${getProgressBar(total, completed + interruptedIndex)} #${lastSuccessfulEventId}`);
      await handleEventsRecursive(
        db,
        remainingEvents,
        completed + interruptedIndex,
        total,
        skipByModel,
        changes,
        abortSignal,
      );
    } else {
      logger.info(`processed: ${getProgressBar(total)} #${events.at(-1)?.id}`);
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

function getProgressBar(total: number, completed = total, length = 20) {
  const ratio = completed / total;
  const totalStrLength = Math.ceil(Math.log10(total));
  const progress = Math.floor(ratio * length);
  const bar = Array.from({ length }, (_, i) => (i < progress ? "=" : " ")).join("");
  return `[${bar}] ${String(completed).padStart(totalStrLength, " ")}/${total}`;
}
