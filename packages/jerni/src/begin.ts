import { EventEmitter } from "node:events";
import { URL } from "node:url";
import hash from "hash-sum";

import UnrecoverableError from "./UnrecoverableError";
import { DBG, INF } from "./cli-utils/log-headers";
import { getEventDatabase, injectEventDatabase } from "./events-storage/injectDatabase";
import getEventStreamFromUrl from "./getEventStream";
import customFetch from "./helpers/fetch";
import normalizeUrl from "./lib/normalize-url";
import skip from "./lib/skip";
import type { JourneyConfig, Store } from "./types/config";
import type { JourneyCommittedEvent } from "./types/events";
import type { JourneyInstance } from "./types/journey";

const RECEIVED_EVENTS = "RECEIVED_EVENTS";
const defaultLogger = console;
const noop = () => {};

export default async function* begin(journey: JourneyInstance, signal: AbortSignal) {
  const config = journey.getConfig();
  const { logger = defaultLogger } = config;

  const { url } = normalizeUrl(config);

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

  const sortedIncludes = Array.from(includedTypes).sort();

  // $SERVER/subscribe
  const subscriptionUrl = new URL("subscribe", url);
  // subscribe url may have a include filter
  if (!includeAll) {
    logger.debug("%s includes", DBG, sortedIncludes.join(","));
    subscriptionUrl.searchParams.set("includes", sortedIncludes.join(","));
  } else {
    logger.debug("%s include all", DBG);
  }

  // this is used to identify the stream of events
  const eventStreamHashKey = getHashedIncludes(sortedIncludes);

  // $SERVER/events/latest
  const getLatestUrl = new URL("events/latest", url);

  logger.log("%s sync'ing with server...", INF);
  const response = await customFetch(getLatestUrl.toString(), {
    headers: {
      "content-type": "application/json",
    },
    signal,
  });
  const latestEvent = (await response.json()) as JourneyCommittedEvent;

  const clientLatest = await getLatestSavedEventId(eventStreamHashKey);

  const serverLatest = latestEvent.id;

  logger.debug("%s server latest event id:", DBG, serverLatest);
  logger.debug("%s client latest event id:", DBG, clientLatest);

  if (serverLatest > clientLatest) {
    logger.debug("%s catching up... (%d events left)", DBG, serverLatest - clientLatest);
  }

  const eventEmitter = new EventEmitter();

  const eventStream = await getEventStreamFromUrl(clientLatest.toString(), subscriptionUrl, signal, logger);

  (async function receiveAndSaveEvents() {
    for await (const data of eventStream) {
      logger.log("saving %d events from event id #%d - #%d", data.length, data[0].id, data[data.length - 1].id);

      await saveEvents(eventStreamHashKey, data);

      eventEmitter.emit(RECEIVED_EVENTS);
    }
  })();

  // ensure all events are cleaned up before the projection starts
  await ensureIncludedEvents(eventStreamHashKey);

  yield* longRunningHandleEvents(config, eventEmitter, signal);
}

export async function* longRunningHandleEvents(config: JourneyConfig, eventEmitter: EventEmitter, signal: AbortSignal) {
  const { logger = defaultLogger } = config;

  try {
    yield* handleEventsInDatabase(config, signal);

    const { promise, resolve } = Promise.withResolvers();

    signal.addEventListener("abort", resolve, { once: true });

    while (!signal.aborted) {
      await Promise.race([promise, EventEmitter.once(eventEmitter, RECEIVED_EVENTS)]);

      yield* handleEventsInDatabase(config, signal);
    }
  } catch (ex) {
    if (ex instanceof UnrecoverableError) {
      logger.info("projection forcefully closed because of unrecoverable error");

      logger.error("unrecoverable error", ex);

      return;
    }

    console.log("ex", ex);
  }
}

async function* handleEventsInDatabase(config: JourneyConfig, signal: AbortSignal) {
  const { logger = defaultLogger, onReport = noop, onError } = config;

  // get latest projected id
  const lastSeenIds = await Promise.all(config.stores.map((store) => store.getLastSeenId()));

  const furthest = Math.min(...lastSeenIds.filter((id) => id !== null));
  const clientLatestId = furthest === Number.POSITIVE_INFINITY ? 0 : furthest;

  logger.debug("starting projection from event id #%d", clientLatestId);

  // should start projection from the last seen id + 1
  const eventsStream = await getEventStream(clientLatestId + 1);

  for await (const events of eventsStream) {
    logger.debug(
      `get ${events.length} events from sqlite to process, range from ${events[0].id} to ${
        events[events.length - 1].id
      }`,
    );

    if (signal.aborted) {
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

    logger.debug(`processed ${events.length} events from ${events[0].id} to ${events[events.length - 1].id}`);
    const loggedOutput = output.map((o) => JSON.stringify(o)).join("\n");
    logger.debug("output: \n", loggedOutput);

    yield {
      output,
      lastProcessedEventId: events[events.length - 1].id,
    };
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

export const getLatestSavedEventId = injectEventDatabase(async function getLatestSavedEventId(hashed: string) {
  return getEventDatabase().getLatestEventId(hashed);
});

export const saveEvents = injectEventDatabase(async function saveEvents(
  hashed: string,
  events: JourneyCommittedEvent[],
) {
  const eventDatabase = getEventDatabase();
  await eventDatabase.insertEvents(hashed, events);
});

const getEventStream = injectEventDatabase(async function getEventStream(
  lastProcessedId: number,
): Promise<AsyncGenerator<JourneyCommittedEvent[]>> {
  return getEventDatabase().streamEventsFrom(lastProcessedId);
});

export const ensureIncludedEvents = injectEventDatabase(async function ensureIncludedEvents(hashed: string) {
  const eventDatabase = getEventDatabase();

  const lastSavedEventId = await eventDatabase.getLatestEventId(hashed);

  // if the last saved event id of the hashed is 0, it means this is a new list of events
  // therefore we need to remove all events so that when the worker starts, it will not read the out dated events
  if (lastSavedEventId === 0) {
    await eventDatabase.clean();
  }
});

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
