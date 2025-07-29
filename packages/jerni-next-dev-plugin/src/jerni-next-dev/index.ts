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
import { markCleanStartDone } from "./cleanStartRequestHelpers";
import { writeLastEventId } from "./eventIdManager";
import { getDevFilesDir } from "./getDevFilesUtils";
import { globalJerniDevLock } from "./global-lock";
import readEventsFromMarkdown from "./readEventsFromMarkdown";
import rewriteChecksum from "./rewriteChecksum";
import { scheduleCommitEvents } from "./scheduleCommit";
import shouldCleanStart from "./shouldCleanStart";

interface JourneyDevInstance extends JourneyInstance {}
let cleanStartPromise: Promise<void> | null = null;

export default function createJourneyDevInstance(config: JourneyConfig): JourneyDevInstance {
  // biome-ignore lint/suspicious/noExplicitAny: this could be any model, there is no way to know the type
  const modelToStoreMap = new Map<any, JourneyConfig["stores"][number]>();
  const logger = config.logger || console;

  const registerOnce = once(registerModels);

  const waiter = createWaiter(config.stores.length);
  let hasStartedWaiting = false;

  // @ts-expect-error
  const eventsFilePath = globalThis.__JERNI_EVENTS_FILE_PATH__;

  const commit = async <T extends keyof CommittingEventDefinitions>(
    uncommittedEvent: ToBeCommittedJourneyEvent<T>,
  ): Promise<TypedJourneyCommittedEvent<T>> => {
    const cleanStartStartTime = Date.now();
    const shouldCleanStartResult = await shouldCleanStart();
    const cleanStartEndTime = Date.now();
    const cleanStartElapsed = cleanStartEndTime - cleanStartStartTime;
    console.log("[JERNI-DEV] commit: clean start check took", cleanStartElapsed, "ms");

    if (shouldCleanStartResult) {
      console.log("clean start requested when committing");
      await cleanStart();
    }

    // should wait for clean start to finish before allow committing
    const now = Date.now();
    logger.log("[JERNI-DEV] [LOCK] commit: waiting for global dev lock...");
    await globalJerniDevLock.waitForUnlock();

    const end = Date.now();
    const elapsed = end - now;
    logger.log("[JERNI-DEV] [LOCK] commit: acquired global dev lock in", elapsed, "ms");

    // persist event
    logger.log("[JERNI-DEV] Committing...");
    const eventId = await scheduleCommitEvents(eventsFilePath, uncommittedEvent);
    const committedEvent: TypedJourneyCommittedEvent<T> = {
      ...uncommittedEvent,
      id: eventId,
    };
    logger.log("[JERNI-DEV] Committed event: #%d - %s", committedEvent.id, committedEvent.type);
    // project event
    for (const store of config.stores) {
      // fixme: should call void
      void store.handleEvents([committedEvent]);
    }

    return committedEvent;
  };

  const journey: JourneyDevInstance = {
    commit,
    append: commit,
    async waitFor(event: JourneyCommittedEvent, timeoutOrSignal?: number | AbortSignal) {
      logger.log("[JERNI-DEV] [LOCK] waitFor: waiting for global dev lock...");
      await globalJerniDevLock.waitForUnlock();
      logger.log("[JERNI-DEV] [LOCK] waitFor: acquired global dev lock");

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
      const shouldCleanStartResult = await shouldCleanStart();

      if (shouldCleanStartResult) {
        console.log("clean start requested when getting reader");
        await cleanStart();
      }

      const now = Date.now();
      logger.log("[JERNI-DEV] [LOCK] getReader: waiting for global dev lock...");
      // should wait for clean start to finish before allow reading from stores
      await globalJerniDevLock.waitForUnlock();
      const end = Date.now();
      const elapsed = end - now;
      logger.log("[JERNI-DEV] [LOCK] getReader: acquired global dev lock in", elapsed, "ms");

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

  return journey;

  async function cleanStart() {
    if (cleanStartPromise) {
      logger.log("[JERNI-DEV] [LOCK] scheduleCleanStart: already running, skipping this request");
      return cleanStartPromise;
    }

    cleanStartPromise = (async () => {
      logger.log("[JERNI-DEV] [LOCK] scheduleCleanStart: waiting for global dev lock...");
      await globalJerniDevLock
        .runExclusive(async () => {
          logger.log("[JERNI-DEV] [LOCK] scheduleCleanStart: acquired global dev lock");
          logger.log("[JERNI-DEV] Begin clean start");
          logger.log("[JERNI-DEV] clean starting jerni dev with config: ", JSON.stringify(config, null, 2));

          // @ts-expect-error
          const eventsFileAbsolutePath = globalThis.__JERNI_EVENTS_FILE_PATH__;
          const devFilesDir = getDevFilesDir();

          // read events from markdown file to sync to sqlite
          const { events, fileChecksum, realChecksum } = await readEventsFromMarkdown(eventsFileAbsolutePath);

          // Reset event ID counter to the last event ID from the events file
          const lastEventId = events.length > 0 ? events[events.length - 1].id : 0;
          logger.log(`[JERNI-DEV] Resetting event ID counter to ${lastEventId}`);
          await writeLastEventId(lastEventId);

          // persist events to stores
          await clearStores();
          await projectEvents(events);

          // rewrite checksum of markdown file if it's modified manually
          if (fileChecksum !== realChecksum) {
            await rewriteChecksum(eventsFileAbsolutePath);
          }

          logger.log("[JERNI-DEV] Finish clean start");
          markCleanStartDone(devFilesDir);
        })
        .finally(() => {
          logger.log("[JERNI-DEV] [LOCK] scheduleCleanStart: released global dev lock");
        });
    })();

    try {
      await cleanStartPromise;
    } finally {
      cleanStartPromise = null;
    }
  }

  async function clearStores() {
    // again ensure stores are safe for dev; better safe than sorry
    await ensureStoresAreSafeForDev();
    for (const store of config.stores) {
      await store.clean();
    }
  }

  async function projectEvents(events: JourneyCommittedEvent[]) {
    for (const store of config.stores) {
      await store.handleEvents(events);
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
