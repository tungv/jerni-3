import type { JourneyConfig, Store } from "./types/config";
import type {
  JourneyCommittedEvent,
  JourneyCommittedEvents,
  LocalEvents,
  TypedJourneyCommittedEvent,
  TypedJourneyEvent,
} from "./types/events";
import type { JourneyInstance } from "./types/journey";
import createWaiter from "./waiter";
import normalizeUrl from "./lib/normalize-url";
import commitToServer from "./lib/commit";
import skip from "./lib/skip";
import UnrecoverableError from "./UnrecoverableError";
import JerniPersistenceError from "./JerniPersistenceError";
import { DBG, INF } from "./cli-utils/log-headers";
import { bold } from "picocolors";
import { getEventDatabase, injectEventDatabase } from "./events-storage/injectDatabase";
import hash from "hash-sum";
import { EventSourcePlus } from "event-source-plus";
import { EventEmitter } from "node:events";
import listenForEventsInServer from "./listenForEventsInServer";

const defaultLogger = console;
const noop = () => {};
const RECEIVED_EVENTS = "RECEIVED_EVENTS";

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
    logger.log("%s store %s complete", DBG, bold(store.toString()));
  }

  const waiter = createWaiter(config.stores.length);

  return {
    async commit<T extends keyof JourneyCommittedEvents>(
      uncommittedEvent: TypedJourneyEvent<T>,
    ): Promise<TypedJourneyCommittedEvent<T>> {
      return commitToServer(logger, url, logSafeUrl, onReport, onError, uncommittedEvent);
    },

    async append<T extends keyof JourneyCommittedEvents>(uncommittedEvent: {
      type: Exclude<T, number>;
      payload: LocalEvents[T];
    }) {
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

      logger.debug("event", event.id, "is ready");

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
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: because this is a placeholder, the client that uses jerni would override this type
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

      // dispose all events
      await disposeAllEvents();
    },

    async *begin(signal: AbortSignal) {
      // we need to resolve all the event types needed
      const includedTypes = new Set<string>();
      let includeAll = false;
      for (const store of config.stores) {
        if (store.meta.includes.length === 0) {
          includeAll = true;
          break;
        }
        for (const type of store.meta.includes) {
          includedTypes.add(type);
        }
      }

      if (includedTypes.size === 0) {
        includeAll = true;
      }

      // $SERVER/subscribe
      const subscriptionUrl = new URL("subscribe", url);
      // subscribe url may have a include filter
      if (!includeAll) {
        logger.debug("%s includes", DBG, Array.from(includedTypes).join(","));
        subscriptionUrl.searchParams.set("includes", Array.from(includedTypes).join(","));
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
      const latestEvent = (await response.json()) as JourneyCommittedEvent;

      const clientLatest = await getLatestSavedEventId(includedTypes);

      const serverLatest = latestEvent.id;

      logger.debug("%s server latest event id:", DBG, serverLatest);
      logger.debug("%s client latest event id:", DBG, clientLatest);

      if (serverLatest > clientLatest) {
        logger.debug("%s catching up...", DBG);
      }

      subscriptionUrl.searchParams.set("lastEventId", clientLatest.toString());

      const eventEmitter = new EventEmitter();

      const eventSource = new EventSourcePlus(subscriptionUrl.toString(), {
        headers: {
          authorization: `Basic ${btoa(`${url.username}:${url.password}`)}`,
        },
      });

      const eventStream = listenForEventsInServer(eventSource, signal);

      (async function receiveAndSaveEvents() {
        for await (const stream of eventStream) {
          const data = JSON.parse(stream) as JourneyCommittedEvent[];

          logger.log("saving %d events from event id #%d - #%d", data.length, data[0].id, data[data.length - 1].id);

          await saveEvents(includedTypes, data);

          eventEmitter.emit(RECEIVED_EVENTS);
        }
      })();

      yield* longRunningHandleEvents(config, eventEmitter, signal);
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

  if ("message" in errorOrUnknown && typeof errorOrUnknown.message === "string") {
    return new Error(errorOrUnknown.message);
  }

  return new Error(JSON.stringify(errorOrUnknown));
}

async function* longRunningHandleEvents(config: JourneyConfig, eventEmitter: EventEmitter, signal: AbortSignal) {
  const { logger = defaultLogger } = config;

  const outputs: unknown[] = [];

  const { promise, resolve } = Promise.withResolvers();

  let unResolvedPromise = promise;
  let resolver = resolve;

  let hasError = false;

  eventEmitter.on(RECEIVED_EVENTS, async () => {
    try {
      const output = await handleEventsInDatabase(config, signal);

      outputs.push(output);

      resolver();
    } catch (ex) {
      hasError = true;
      resolver();

      if (ex instanceof UnrecoverableError) {
        logger.info("projection forcefully closed because of unrecoverable error");

        logger.error("unrecoverable error", ex);

        return;
      }

      console.log("ex", ex);
    }
  });

  signal.addEventListener(
    "abort",
    () => {
      resolver();
    },
    { once: true },
  );

  while (!signal.aborted && !hasError) {
    const data = outputs.shift();

    if (!data) {
      await unResolvedPromise;

      if (signal.aborted) {
        break;
      }

      const { promise, resolve } = Promise.withResolvers();
      unResolvedPromise = promise;
      resolver = resolve;

      continue;
    }

    yield data;
  }

  eventEmitter.removeAllListeners(RECEIVED_EVENTS);
}

async function handleEventsInDatabase(config: JourneyConfig, signal?: AbortSignal) {
  const { logger = defaultLogger, onReport = noop, onError } = config;

  // get latest projected id
  // const lastSeenIds = await Promise.all(config.stores.map((store) => store.getLastSeenId()));

  // const furthest = Math.min(...lastSeenIds.filter((id) => id !== null));
  // const clientLatestId = furthest === Number.POSITIVE_INFINITY ? 0 : furthest;

  // const eventDatabase = getEventDatabase();
  // const eventsStream = eventDatabase.streamEventsFrom(0);
  const eventsStream = await getEventStream();

  for await (const events of eventsStream) {
    if (signal?.aborted) {
      logger.info("aborting projection...");
      break;
    }

    const output = await Promise.all(
      config.stores.map(async (store) => {
        const output = await singleStoreHandleEvents(store, events);
        onReport("store_output", {
          store,
          output,
        });

        return output;
      }),
    );
    if (output.some((output) => output)) {
      logger.info("output", output);
    }

    return output;
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
      logger.info("%s store: %s is handling events [#%d - #%d]", intermediateStep, store.name, firstId, lastId);
    }

    try {
      const output = await store.handleEvents(events);

      return output;
    } catch (ex) {
      // if there is only one event, we don't need to bisect
      if (events.length === 1) {
        logger.info(`${I} 🔍 Identified offending event:  #${events[0].id} - ${events[0].type}`);
        const resolution = onError(wrapError(ex), events[0]);

        if (resolution === skip) {
          logger.log(`${I} ▶️ Resolution is SKIP .......... MOVE ON!`);
          return [];
        }
        logger.log(`${T} 💀 Resolution is not SKIP       STOP WORKER!`);
        throw new UnrecoverableError(events[0]);
      }

      logger.log(`${I} 🔴 Encountered error ....${tab} between #${firstId} and #${lastId}`);

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
          logger.info(`${I} Retry LEFT ..............${tab} #${firstId} - ${events[0].type}`);
        } else {
          logger.info(`${I} Retry LEFT ..............${tab} [#${firstId} - #${midId - 1}]`);
        }
        const start = Date.now();
        const leftOutput = await singleStoreHandleEvents(store, left, indent + 1, total);
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
          logger.info(`${I} Retry RIGHT .............${tab} 1 event on from #${midId}`);
        } else {
          logger.info(`${I} Retry RIGHT .............${tab} [#${midId} - #${lastId}]`);
        }
        const start = Date.now();
        const rightOutput = await singleStoreHandleEvents(store, right, indent + 1, total);
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
}

function getHashedIncludes(includes: string[]) {
  return hash(includes.sort());
}

const getLatestSavedEventId = injectEventDatabase(async function getLatestSavedEventId(includedTypes: Set<string>) {
  const includes = Array.from(includedTypes);
  const hashed = getHashedIncludes(includes);

  return getEventDatabase().getLatestEventId(hashed);
});

const disposeAllEvents = injectEventDatabase(async function disposeAllEvents() {
  return getEventDatabase().dispose();
});

const saveEvents = injectEventDatabase(async function handleEvents(
  includeList: Set<string>,
  events: JourneyCommittedEvent[],
) {
  const hashed = getHashedIncludes(Array.from(includeList).sort());

  const eventDatabase = getEventDatabase();
  await eventDatabase.insertEvents(hashed, events);
});

const getEventStream = injectEventDatabase(async function getEventStream(): Promise<
  AsyncGenerator<JourneyCommittedEvent[]>
> {
  return getEventDatabase().streamEventsFrom(0);
});
