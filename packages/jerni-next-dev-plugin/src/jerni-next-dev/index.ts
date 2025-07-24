/**
 * FIXME: import module one level above will cause error on users.
 * E.g: import abc from ""../abc.mjs"
 * The error on users side is `Cannot resolve module "@jerni/jerni-3"...`.
 * Likely because of the way we set the `exports` field in `package.json` for this package.
 */

import JerniPersistenceError from "@jerni/jerni-3/lib/errors/JerniPersistenceError";
import type {
  CommittingEventDefinitions,
  JourneyCommittedEvent,
  JourneyConfig,
  JourneyInstance,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "@jerni/jerni-3/types";
import once from "../lib/once";
import createWaiter from "../lib/waiter";
import { scheduleCommitEvents } from "./scheduleCommit";
import shouldCleanStart from "./shouldCleanStart";

interface JourneyDevInstance extends JourneyInstance {}

export default function createJourneyDevInstance(config: JourneyConfig): JourneyDevInstance {
  // biome-ignore lint/suspicious/noExplicitAny: this could be any model, there is no way to know the type
  const modelToStoreMap = new Map<any, JourneyConfig["stores"][number]>();
  const logger = config.logger || console;

  const registerOnce = once(registerModels);

  const waiter = createWaiter(config.stores.length);
  let hasStartedWaiting = false;

  // @ts-expect-error
  const eventsFilePath = globalThis.__JERNI_EVENTS_FILE_PATH__;

  let isCleanStarting = false;

  const commit = async <T extends keyof CommittingEventDefinitions>(
    uncommittedEvent: ToBeCommittedJourneyEvent<T>,
  ): Promise<TypedJourneyCommittedEvent<T>> => {
    // wait for the boot up clean start to finish
    await forceJerniCleanStartPromise;
    // check again to see if need another clean start in case things happened while boot up
    if (await shouldCleanStart()) {
      await scheduleCleanStart();
    }
    // persist event
    logger.log("[JERNI-DEV] Committing...");
    const eventId = await scheduleCommitEvents(eventsFilePath, [uncommittedEvent]);
    const committedEvent: TypedJourneyCommittedEvent<T> = {
      ...uncommittedEvent,
      id: eventId,
    };
    logger.log("[JERNI-DEV] Committed event: #%d - %s", committedEvent.id, committedEvent.type);
    // project event
    for (const store of config.stores) {
      // fixme: should call flushEvents
      void store.handleEvents([committedEvent]);
    }
    return committedEvent;
  };

  const journey: JourneyDevInstance = {
    commit,
    append: commit,
    async waitFor(event: JourneyCommittedEvent, timeoutOrSignal?: number | AbortSignal) {
      logger.log("[JERNI-DEV] Waiting for event", event.id);
      if (!hasStartedWaiting) {
        hasStartedWaiting = true;

        for (let storeIndex = 0; storeIndex < config.stores.length; storeIndex++) {
          const store = config.stores[storeIndex];

          (async () => {
            for await (const checkpoint of store.listen()) {
              waiter.increment(storeIndex, checkpoint);
            }
          })();
        }
      }

      const { id } = event;
      const start = Date.now();
      try {
        if (timeoutOrSignal) {
          await waiter.wait(id, timeoutOrSignal);
        } else {
          await waiter.wait(id, 3_000);
        }
      } catch (ex) {
        if (ex instanceof Error && ex.name === "AbortError") {
          const end = Date.now();
          const elapsed = end - start;
          logger.error("[JERNI-DEV] Event", event.id, "is not ready in", elapsed, "ms");
          throw new JerniPersistenceError(event, elapsed);
        }
      }

      if (
        event.meta &&
        typeof event.meta === "object" &&
        "committed_at" in event.meta &&
        typeof event.meta.committed_at === "number"
      ) {
        const waited = Date.now();
        const turnaround = waited - event.meta.committed_at;
        logger.log("[JERNI-DEV] Event", event.id, "is ready in", turnaround, "ms");
      } else {
        logger.log("[JERNI-DEV] Event", event.id, "is ready");
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: because this is a placeholder, the client that uses jerni would override this type
    async getReader(model: any): Promise<any> {
      // wait for the boot up clean start to finish
      await forceJerniCleanStartPromise;
      // check again to see if need another clean start in case things happened while boot up
      if (await shouldCleanStart()) {
        await scheduleCleanStart();
      }
      registerOnce();
      const store = modelToStoreMap.get(model);

      if (!store) {
        throw new Error("model is not registered");
      }

      return store.getDriver(model);
    },
    getConfig() {
      return {
        ...config,
        server: "localhost",
        onError: () => {}, // fixme: mimic the behavior of jerni-3
      };
    },
    async dispose() {
      // todo: should we wait for clean start to finish?
      for (const store of config.stores) {
        await store.dispose();
      }
    },
  };

  // force clean start on boot up
  const forceJerniCleanStartPromise = shouldCleanStartForBootUp()
    ? scheduleCleanStart().then(markBootUpCleanStartDone)
    : Promise.resolve();

  return journey;

  async function scheduleCleanStart() {
    logger.log("[JERNI-DEV] Begin clean start");

    // prevent duplicate clean start
    if (isCleanStarting) return;

    isCleanStarting = true;

    // @ts-expect-error
    const eventsFileAbsolutePath = globalThis.__JERNI_EVENTS_FILE_PATH__;

    // read events from markdown file to sync to sqlite
    const { events } = await readEventsFromMarkdown(eventsFileAbsolutePath);

    // rewrite checksum of markdown file in background
    const rewriteChecksumPromise = rewriteChecksum(eventsFileAbsolutePath);

    // persist events to stores
    await clearStores();
    await projectEvents(events);

    // wait for rewrite checksum to finish
    await rewriteChecksumPromise;

    isCleanStarting = false;
    logger.log("[JERNI-DEV] Finish clean start");
  }

  async function clearStores() {
    // again ensure stores are safe for dev; better safe than sorry
    await ensureStoresAreSafeForDev();
    for (const store of config.stores) {
      await store.clean();
    }
  }

  async function projectEvents(events: any[]) {
    let eventId = 1;

    // project events
    for (const event of events) {
      for (const store of config.stores) {
        // fixme: should call flushEvents
        const committedEvent = {
          ...event,
          id: eventId,
        };
        await store.handleEvents([committedEvent]);
      }
      eventId++;
    }
  }

  function registerModels() {
    // loop through all stores and map them to their models
    logger.log("[JERNI-DEV] Registering models...");
    for (const store of config.stores) {
      store.registerModels(modelToStoreMap);
      logger.log("[JERNI-DEV] Store %s complete", store.toString());
    }
  }

  async function ensureStoresAreSafeForDev() {
    const isSafeForDev = await areStoresSafeForDev();
    if (!isSafeForDev) {
      logger.error("[JERNI-DEV] Error: STORES_NOT_FOR_DEV. Terminating program...");
      process.exit(1);
    }
  }

  async function areStoresSafeForDev() {
    // check if stores are safe for dev
    const storesSafetyCheck = await Promise.all(
      config.stores.map(async (store): Promise<boolean> => {
        if ("isSafeForDev" in store === false) {
          logger.error(
            "[JERNI-DEV] Store %s does not support jerni-next-dev-plugin. Please upgrade your store.",
            store.name,
          );
          return false;
        }

        // @ts-expect-error Old stores do not have `isSafeForDev()`
        const isSafeForDev: boolean = await store.isSafeForDev();
        if (!isSafeForDev) {
          // todo: add instructions
          logger.error("[JERNI-DEV] Store %s is not for dev.", store.name);
        }
        return isSafeForDev;
      }),
    );

    return storesSafetyCheck.every(Boolean);
  }
}
