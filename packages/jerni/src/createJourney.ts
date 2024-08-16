import picocolors from "picocolors";
import JerniPersistenceError from "./JerniPersistenceError";
import { DBG, INF } from "./cli-utils/log-headers";
import commitToServer from "./lib/commit";
import normalizeUrl from "./lib/normalize-url";
import once from "./lib/once";
import type { JourneyConfig } from "./types/config";
import type {
  CommittingEventDefinitions,
  JourneyCommittedEvent,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "./types/events";
import type { JourneyInstance } from "./types/journey";
import createWaiter from "./waiter";

const defaultLogger = console;
const noop = () => {};

export default function createJourney(config: JourneyConfig): JourneyInstance {
  let hasStartedWaiting = false;

  // biome-ignore lint/suspicious/noExplicitAny: this could be any model, there is no way to know the type
  const modelToStoreMap = new Map<any, JourneyConfig["stores"][number]>();

  const { logger = defaultLogger, onReport = noop, onError } = config;
  const { url, logSafeUrl } = normalizeUrl(config);

  onReport("server_url_resolved", {
    url: logSafeUrl.toString(),
  });

  logger.log("%s using server url: %s", INF, logSafeUrl.toString());

  // loop through all stores and map them to their models
  logger.debug("%s registering models...", DBG);
  for (const store of config.stores) {
    store.registerModels(modelToStoreMap);
    logger.log("%s store %s complete", DBG, picocolors.bold(store.toString()));
  }

  const waiter = createWaiter(config.stores.length);
  const registerOnce = once(registerModels);

  return {
    async commit<T extends keyof CommittingEventDefinitions>(
      uncommittedEvent: ToBeCommittedJourneyEvent<T>,
    ): Promise<TypedJourneyCommittedEvent<T>> {
      return commitToServer(logger, url, logSafeUrl, onReport, onError, uncommittedEvent);
    },

    async append<T extends keyof CommittingEventDefinitions>(uncommittedEvent: ToBeCommittedJourneyEvent<T>) {
      return commitToServer(logger, url, logSafeUrl, onReport, onError, uncommittedEvent);
    },

    async waitFor(event: JourneyCommittedEvent, timeoutOrSignal?: number | AbortSignal) {
      logger.debug("waiting for event", event.id);

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
          logger.error("event", event.id, "is not ready in", elapsed, "ms");
          onReport("event_wait_timeout", {
            event_id: event.id,
            elapsed,
          });
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
        const elapsed = waited - start;
        logger.debug("event", event.id, "is ready in", turnaround, "ms");
        onReport("event_ready", {
          event_type: event.type,
          event_id: event.id,
          turnaround,
          elapsed,
        });
      } else {
        logger.debug("event", event.id, "is ready");
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: because this is a placeholder, the client that uses jerni would override this type
    async getReader(model: any): Promise<AsyncDisposable> {
      registerOnce();
      const store = modelToStoreMap.get(model);

      if (!store) {
        throw new Error("model is not registered");
      }

      return store.getDriver(model);
    },
    getConfig: () => config,
    dispose: async () => {
      for (const store of config.stores) {
        await store.dispose();
      }
    },
  };

  function registerModels() {
    // loop through all stores and map them to their models
    logger.debug("%s registering models...", DBG);
    for (const store of config.stores) {
      store.registerModels(modelToStoreMap);
      logger.log("%s store %s complete", DBG, picocolors.bold(store.toString()));
    }
  }
}
