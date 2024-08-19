import { mkdir } from "node:fs/promises";
import UnrecoverableError from "./UnrecoverableError";
import { DBG, INF } from "./cli-utils/log-headers";
import getEventStreamFromUrl from "./getEventStream";
import customFetch from "./helpers/fetch";
import normalizeUrl from "./lib/normalize-url";
import skip from "./lib/skip";
import makeDb, { type EventDatabase } from "./sqlite";
import type { Logger } from "./types/Logger";
import type { JourneyConfig, Store } from "./types/config";
import type { JourneyCommittedEvent } from "./types/events";
import type { JourneyInstance } from "./types/journey";

const defaultLogger = console;

interface RunConfig {
  dbFolder: string;
}

export default async function* begin(journey: JourneyInstance, signal: AbortSignal, runConfig?: RunConfig) {
  const runId = Math.random().toString(36).slice(2);
  const config = journey.getConfig();
  const { logger = defaultLogger } = config;

  const { url } = normalizeUrl(config);

  const folder = runConfig?.dbFolder ?? "/tmp/jerni-cli/runs";
  await mkdir(folder, { recursive: true });
  const sqlFilePath = `${folder}/events-${runId}.sqlite`;

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

  // get latest projected id
  const lastSeenIds = await Promise.all(config.stores.map((store) => store.getLastSeenId()));

  // adding a zero to the list to ensure it will always return a finite number
  const furthest = Math.min(...lastSeenIds.filter((id) => id !== null));
  const clientLatest = Number.isFinite(furthest) ? furthest : 0;

  const serverLatest = latestEvent.id;

  logger.debug("%s server latest event id:", DBG, serverLatest);
  logger.debug("%s client latest event id:", DBG, clientLatest);

  if (serverLatest > clientLatest) {
    logger.debug("%s catching up... (%d events left)", DBG, serverLatest - clientLatest);
  }

  logger.info("persisting unhandled events in", sqlFilePath);
  const db = makeDb(sqlFilePath);

  let latestPersisted = clientLatest;
  let latestHandled = clientLatest;

  (async () => {
    const eventStream = await getEventStreamFromUrl(clientLatest.toString(), subscriptionUrl, db, signal, logger);
    for await (const latestId of eventStream) {
      if (latestId > latestPersisted) {
        latestPersisted = latestId;
      }
    }
  })();

  // pick up event to handle
  while (!signal.aborted) {
    if (latestHandled < latestPersisted) {
      const outputs = await handleEventBatch(
        config.stores,
        config.onError,
        db,
        [latestHandled, latestPersisted],
        logger,
        signal,
      );
      latestHandled = latestPersisted;
      logger.info("processed events up to #%d", latestHandled);
      yield outputs;
    }

    await Bun.sleep(10);
  }
}

async function handleEventBatch(
  stores: JourneyConfig["stores"],
  onError: JourneyConfig["onError"],
  db: EventDatabase,
  idArray: [start: number, end: number],
  logger: Logger,

  // FIXME: store.handleEvents should also be cancellable
  _signal: AbortSignal,
) {
  const events = db.getBlock(idArray[0], idArray[1]);

  if (!events.length) {
    logger.info("No events to handle");
    return [];
  }

  const output = await Promise.all(
    stores.map(async (store) => {
      const output = await singleStoreHandleEvents(store, events, 0, events.length, logger, onError);

      return output;
    }),
  );

  return output;
}

async function singleStoreHandleEvents(
  store: Store,
  events: JourneyCommittedEvent[],
  indent: number,
  total: number,
  logger: Logger,
  onError: JourneyConfig["onError"],
) {
  const firstId = events[0].id;
  const lastId = events.at(-1)?.id;

  const conclusion = "└";
  const intermediateStep = "├";
  const indentStr = "│ ".repeat(indent);
  const maxLog = Math.log2(events.length) | 0;
  const tab = "..".repeat(3 + Math.max(0, maxLog));
  const I = `${indentStr}${intermediateStep}`;
  const C = `${indentStr}${conclusion}`;
  const T = "└─".repeat(indent); // termination line

  if (indent === 0) {
    const msg =
      lastId === firstId
        ? `${I} ${store.name} is handling event #${firstId}`
        : `${I} ${store.name} is handling events [#${firstId} - #${lastId}]`;
    logger.info(msg);
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
      await singleStoreHandleEvents(store, left, indent + 1, total, logger, onError);
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
      await singleStoreHandleEvents(store, right, indent + 1, total, logger, onError);
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
