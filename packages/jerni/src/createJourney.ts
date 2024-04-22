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
import { DBG, INF } from "./cli-utils/log-headers";
import { bold } from "picocolors";

const MyEventSource = getEventSource();
const defaultLogger = console;
const noop = () => {};

export default function createJourney(config: JourneyConfig): JourneyInstance {
  let serverLatest = 0;
  let clientLatest = 0;

  let hasStartedWaiting = false;

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
    console.log("%s store %s complete", DBG, bold(store.toString()));
  }

  const waiter = createWaiter(config.stores.length);

  async function handleEvents(events: JourneyCommittedEvent[]) {
    logger.debug("%s received %d events", DBG, events.length);
    try {
      const output = await Promise.all(
        config.stores.map(async (store) => {
          const output = await singleStoreHandleEvents(store, events);
          console.log("output", output);
          onReport("store_output", {
            store,
            output,
          });
        }),
      );
      if (output.some((output) => output)) {
        logger.info("output", output);
      }
    } catch (ex) {
      if (ex instanceof UnrecoverableError) {
        throw ex;
      }
      console.log("ex", ex);
    }
  }

  async function singleStoreHandleEvents(
    store: Store,
    events: JourneyCommittedEvent[],
    indent = 0,
    total = events.length,
  ) {
    if (events.length === 0) {
      return [];
    }

    const firstId = events[0].id;
    const lastId = events[events.length - 1].id;
    const conclusion = "└";
    const intermediateStep = "├";
    const indentStr = "│ ".repeat(indent);
    const maxLog = Math.log2(events.length) | 0;
    const tab = "..".repeat(3 + Math.max(0, maxLog));
    const I = `${indentStr}${intermediateStep}`;
    const C = `${indentStr}${conclusion}`;
    const T = "└─".repeat(indent); // termination line

    if (indent === 0) {
      logger.info(
        "%s store: %s is handling events [#%d - #%d]",
        intermediateStep,
        store.name,
        firstId,
        lastId,
      );
    }

    try {
      const output = await store.handleEvents(events);

      return output;
    } catch (ex) {
      // if there is only one event, we don't need to bisect
      if (events.length === 1) {
        logger.info(
          `${I} 🔍 Identified offending event:  #${events[0].id} - ${events[0].type}`,
        );
        const resolution = onError(wrapError(ex), events[0]);

        if (resolution === skip) {
          logger.log(`${I} ▶️ Resolution is SKIP .......... MOVE ON!`);
          return [];
        }
        logger.log(`${T} 💀 Resolution is not SKIP       STOP WORKER!`);
        throw new UnrecoverableError(events[0]);
      } else {
        logger.log(
          `${I} 🔴 Encountered error ....${tab} between #${firstId} and #${lastId}`,
        );
      }

      // bisect events
      const mid = Math.floor(events.length / 2);
      const midId = events[mid].id;
      const maxStep = Math.ceil(Math.log2(total));
      const bisectDescription = `step ${indent + 1} of ${maxStep}`;
      logger.info(`${I} Bisecting: ${bisectDescription}`);
      const left = events.slice(0, mid);
      const right = events.slice(mid);

      // retry left
      try {
        if (left.length === 1) {
          logger.info(
            `${I} Retry LEFT ..............${tab} #${firstId} - ${events[0].type}`,
          );
        } else {
          logger.info(
            `${I} Retry LEFT ..............${tab} [#${firstId} - #${
              midId - 1
            }]`,
          );
        }
        const start = Date.now();
        const leftOutput = await singleStoreHandleEvents(
          store,
          left,
          indent + 1,
          total,
        );
        const end = Date.now();
        logger.log(`${I} 🟢    LEFT SUCCESS (took ${end - start}ms)`);
      } catch (retryEx) {
        // is it recoverable?
        if (retryEx instanceof UnrecoverableError) {
          logger.debug(`${C} left is unrecoverable`);
          throw retryEx;
        }
      }

      // if left succeeds, retry right
      try {
        if (right.length === 1) {
          logger.info(
            `${I} Retry RIGHT .............${tab} 1 event on from #${midId}`,
          );
        } else {
          logger.info(
            `${I} Retry RIGHT .............${tab} [#${midId} - #${lastId}]`,
          );
        }
        const start = Date.now();
        const rightOutput = await singleStoreHandleEvents(
          store,
          right,
          indent + 1,
          total,
        );
        const end = Date.now();
        logger.log(`${I} 🟢 RIGHT SUCCESS (took ${end - start}ms)`);
      } catch (retryEx) {
        // is it recoverable?
        if (retryEx instanceof UnrecoverableError) {
          logger.debug(`${C} right is unrecoverable`);
          throw retryEx;
        }
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
      // we need to resolve all the event types needed
      const includedTypes = new Set<string>();
      let includeAll = false;
      for (const store of config.stores) {
        if (store.meta.includes.length === 0) {
          includeAll = true;
          break;
        }
        store.meta.includes.forEach((type) => includedTypes.add(type));
      }

      if (includedTypes.size === 0) {
        includeAll = true;
      }

      const emitter = new EventEmitter();

      signal?.addEventListener("abort", () => {
        logger.debug("aborting journey...");
        emitter.emit("close");
      });

      // $SERVER/subscribe
      const subscriptionUrl = new URL("subscribe", url);
      // subscribe url may have a include filter
      if (!includeAll) {
        logger.debug("%s includes", DBG, Array.from(includedTypes).join(","));
        subscriptionUrl.searchParams.set(
          "includes",
          Array.from(includedTypes).join(","),
        );
      } else {
        logger.debug("%s include all", DBG);
      }

      // $SERVER/events/latest
      const getLatestUrl = new URL("events/latest", url);

      logger.log("%s sync'ing with server...", INF);
      const response = await fetch(getLatestUrl.toString(), {
        headers: {
          "content-type": "application/json",
        },
        signal,
      });
      const latestEvent = (await response.json()) as JourneyCommittedEvent<
        any,
        any
      >;

      serverLatest = latestEvent.id;

      // get latest client

      const lastSeens = await Promise.all(
        config.stores.map((store) => store.getLastSeenId()),
      );

      const furthest = Math.min(...lastSeens.filter((id) => id !== null));
      clientLatest = furthest === Infinity ? 0 : furthest;

      logger.debug("%s server latest event id:", DBG, serverLatest);
      logger.debug("%s client latest event id:", DBG, clientLatest);

      if (serverLatest > clientLatest) {
        logger.debug("%s catching up...", DBG);
      }

      subscriptionUrl.searchParams.set("lastEventId", clientLatest.toString());

      const ev = new MyEventSource(subscriptionUrl.toString(), signal);

      ev.addEventListener("open", (event) => {
        logger.info("%s start receiving data", INF);
      });

      ev.addEventListener("START", (event) => {
        // logger.debug("event", event.data);
      });

      ev.addEventListener("INCMSG", async (event) => {
        const data = JSON.parse(event.data) as JourneyCommittedEvent[];
        try {
          await handleEvents(data);
        } catch (ex) {
          if (ex instanceof UnrecoverableError) {
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
