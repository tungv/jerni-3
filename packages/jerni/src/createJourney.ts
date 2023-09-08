import { getEventSource } from "./getEventSource";
import { JourneyConfig, Store } from "./types/config";
import {
  JourneyCommittedEvent,
  LocalEvents,
  TypedJourneyCommittedEvent,
  TypedJourneyEvent,
} from "./types/events";
import { JourneyInstance } from "./types/journey";
import createWaiter from "./waiter";
import normalizeUrl from "./lib/normalize-url";
import commitToServer from "./lib/commit";
import skip from "./lib/skip";
import UnrecoverableError from "./UnrecoverableError";
import EventEmitter from "events";
import JerniPersistenceError from "./JerniPersistenceError";

const MyEventSource = getEventSource();

export default function createJourney(config: JourneyConfig): JourneyInstance {
  let serverLatest = 0;
  let clientLatest = 0;

  let hasStartedWaiting = false;

  const modelToStoreMap = new Map<any, JourneyConfig["stores"][number]>();

  const { logger, onReport, onError } = config;
  const { url, logSafeUrl } = normalizeUrl(config);

  onReport("server_url_resolved", {
    url: logSafeUrl.toString(),
  });

  logger.debug("using server url: %s", logSafeUrl.toString());

  // loop through all stores and map them to their models
  logger.debug("registering models...");
  for (const store of config.stores) {
    store.registerModels(modelToStoreMap);
  }

  const waiter = createWaiter(config.stores.length);

  async function handleEvents(events: JourneyCommittedEvent[]) {
    logger.debug("received events", events);
    const output = await Promise.all(
      config.stores.map((store) => singleStoreHandleEvents(store, events)),
    );
    console.info("output", output);
  }

  async function singleStoreHandleEvents(
    store: Store,
    events: JourneyCommittedEvent[],
  ) {
    if (events.length === 0) {
      return [];
    }

    logger.debug(
      "store: %s is handling events [%d - %d]",
      store.name,
      events[0].id,
      events[events.length - 1].id,
    );
    try {
      const output = await store.handleEvents(events);

      return output;
    } catch (ex) {
      // if there is only one event, we don't need to bisect
      if (events.length === 1) {
        const resolution = onError(wrapError(ex), events[0]);
        if (resolution === skip) {
          return [];
        }
        throw new UnrecoverableError(events[0]);
      }

      // bisect events
      const mid = Math.floor(events.length / 2);
      const left = events.slice(0, mid);
      const right = events.slice(mid);

      // retry left
      try {
        const leftOutput = await singleStoreHandleEvents(store, left);
      } catch (retryEx) {
        // if left fails
      }

      // if left succeeds, retry right
      try {
        const rightOutput = await singleStoreHandleEvents(store, right);
      } catch (retryEx) {
        // if right fails
      }
    }
  }

  return {
    async commit<T extends string>(
      uncommittedEvent: TypedJourneyEvent<T>,
    ): Promise<TypedJourneyCommittedEvent<T>> {
      return commitToServer(
        logger,
        url,
        logSafeUrl,
        onReport,
        onError,
        uncommittedEvent,
      );
    },

    async append<T extends keyof LocalEvents>(uncommittedEvent: {
      type: Exclude<T, number>;
      payload: LocalEvents[T];
    }) {
      return commitToServer(
        logger,
        url,
        logSafeUrl,
        onReport,
        onError,
        uncommittedEvent,
      );
    },

    async waitFor(
      event: JourneyCommittedEvent,
      timeoutOrSignal?: number | AbortSignal,
    ) {
      logger.debug("waiting for event", event.id);

      if (!hasStartedWaiting) {
        hasStartedWaiting = true;

        for (
          let storeIndex = 0;
          storeIndex < config.stores.length;
          storeIndex++
        ) {
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

      logger.debug("event", event.id, "is ready");

      if (event.meta?.committed_at) {
        const waited = Date.now();
        const turnaround = waited - event.meta.committed_at;
        logger.debug("event", event.id, "is ready in", turnaround, "ms");
        onReport("event_ready", {
          event_id: event.id,
          turnaround,
        });
      }
    },
    async getReader(model: any) {
      const store = modelToStoreMap.get(model);

      if (!store) {
        throw new Error("model is not registered");
      }

      return store.getDriver(model);
    },
    dispose: async () => {
      logger.debug("Disposing journey...");

      // dispose all stores
      for (const store of config.stores) {
        await store.dispose();
      }
    },

    async *begin(signal?: AbortSignal) {
      const emitter = new EventEmitter();
      logger.debug("Starting journey...");

      // $SERVER/subscribe
      const subscriptionUrl = new URL("subscribe", url);
      // $SERVER/events/latest
      const getLatestUrl = new URL("events/latest", url);

      const response = await fetch(getLatestUrl.toString(), {
        headers: {
          "content-type": "application/json",
        },
        signal,
      });
      const latestEvent: JourneyCommittedEvent<any, any> =
        await response.json();

      serverLatest = latestEvent.id;

      logger.debug("server latest event id:", serverLatest);
      logger.debug("client latest event id:", clientLatest);

      if (serverLatest > clientLatest) {
        logger.debug("catching up...");
      }

      subscriptionUrl.searchParams.set("lastEventId", clientLatest.toString());
      const ev = new MyEventSource(subscriptionUrl.toString(), signal);

      ev.addEventListener("open", (event) => {
        logger.info("start receiving data");
      });

      ev.addEventListener("START", (event) => {
        logger.debug("event", event.data);
      });

      ev.addEventListener("INCMSG", async (event) => {
        const data = JSON.parse(event.data) as JourneyCommittedEvent[];
        try {
          await handleEvents(data);
        } catch (ex) {
          if (ex instanceof UnrecoverableError) {
            logger.error(ex);

            logger.info(
              "connection forcefully closed because of unrecoverable error",
            );
            ev.close();
            emitter.emit("close");
          }
        }
      });

      ev.addEventListener("error", (event) => {
        logger.error(event as ErrorEvent);

        ev.close();
      });

      await EventEmitter.once(emitter, "close");
      console.log("closed");

      return;
    },
  };
}

function wrapError(errorOrUnknown: unknown): Error {
  if (errorOrUnknown instanceof Error) {
    return errorOrUnknown;
  }

  if (typeof errorOrUnknown === "string") {
    return new Error(errorOrUnknown);
  }

  if (typeof errorOrUnknown !== "object") {
    return new Error(JSON.stringify(errorOrUnknown));
  }

  if (errorOrUnknown == null) {
    return new Error("UnknownError");
  }

  if ("name" in errorOrUnknown && typeof errorOrUnknown.name === "string") {
    return new Error(errorOrUnknown.name);
  }

  if (
    "message" in errorOrUnknown &&
    typeof errorOrUnknown.message === "string"
  ) {
    return new Error(errorOrUnknown.message);
  }

  return new Error(JSON.stringify(errorOrUnknown));
}
