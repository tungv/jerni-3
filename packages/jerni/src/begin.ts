import { memoryUsage } from "bun:jsc";
import { mkdir } from "node:fs/promises";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import UnrecoverableError from "./UnrecoverableError";
import { DBG, ERR, INF } from "./cli-utils/log-headers";
import getEventStreamFromUrl from "./getEventStream";
import normalizeUrl from "./lib/normalize-url";
import skip from "./lib/skip";
import makeDb from "./sqlite";
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
  const response = await fetch(getLatestUrl.toString(), {
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

  const newEventNotifier = new EventTarget();

  (async () => {
    const eventStream = await getEventStreamFromUrl(clientLatest.toString(), subscriptionUrl, db, signal, logger);
    for await (const latestId of eventStream) {
      if (latestId > latestPersisted) {
        latestPersisted = latestId;
        newEventNotifier.dispatchEvent(new Event("latest"));
      }
    }
  })();

  // pick up event to handle
  let maxEvents = 256;
  let tooMuch = false;
  let lastProcessingTime = Date.now();
  const timeBudget = 10_000;

  while (!signal.aborted) {
    while (latestHandled < latestPersisted) {
      const timeout = AbortSignal.timeout(timeBudget);

      logger.info(
        `${INF} [HANDLING_EVENT] handling events from #${latestHandled} to #${latestPersisted}, but at most ${maxEvents}`,
      );
      const events = db.getBlock(latestHandled, latestPersisted, maxEvents);

      logger.info(`${INF} [HANDLING_EVENT] there are ${events.length} new events ready to be handled`);
      logger.debug(`${DBG} [HANDLING_EVENT] attempting to process new events in ${prettyMilliseconds(timeBudget)}`);

      try {
        // handle events must stop after 10 seconds
        const start = Date.now();
        const { output, lastId } = await handleEventBatch(config.stores, config.onError, events, logger, timeout);
        latestHandled = lastId;
        const total = Date.now() - start;
        logger.info(
          `${INF} [HANDLING_EVENT] processed events up to #${latestHandled} in ${total}ms (pace: ${(
            total / events.length
          ).toFixed(3)}ms/event)`,
        );

        lastProcessingTime = Date.now();

        yield output;

        logger.debug(`current memory usage: ${prettyBytes(memoryUsage().current)} (AFTER EVENT PROCESSING)`);

        // if all events are handled, we can increase the maxEvents
        if (tooMuch) {
          maxEvents = 256;
          tooMuch = false;
        }
      } catch (ex) {
        if (timeout.aborted) {
          tooMuch = true;
          maxEvents = Math.max(1, Math.floor(events.length / 2));

          logger.info(`${INF} [HANDLING_EVENT] timeout while handling events`);
          logger.info(`${INF} [HANDLING_EVENT] retrying with maxEvents = ${maxEvents}`);
          break;
        }
        console.error(`${ERR} [HANDLING_EVENT] something went wrong while handling events`, ex);
      }
    }

    logger.debug(
      `${DBG} [HANDLING_EVENT] waiting for new events… after ${prettyMilliseconds(Date.now() - lastProcessingTime, {
        colonNotation: true,
      })}`,
    );

    const { promise, resolve } = Promise.withResolvers();
    const ctrl = new AbortController();

    // check for new events at most every 60 seconds
    Bun.sleep(60_000).then(() => {
      ctrl.abort();
      resolve();
    });

    newEventNotifier.addEventListener("latest", resolve, { once: true, signal: ctrl.signal });

    await promise;
  }
}

async function handleEventBatch(
  stores: JourneyConfig["stores"],
  onError: JourneyConfig["onError"],
  events: JourneyCommittedEvent[],
  logger: Logger,
  signal: AbortSignal,
) {
  // biome-ignore lint/style/noNonNullAssertion: we just check events.length
  const lastId = events.at(-1)!.id;

  // race between signal and handling events
  const output = await Promise.race([
    Promise.all(
      stores.map(async (store) => {
        const output = await singleStoreHandleEvents(store, events, 0, events.length, logger, onError, signal);

        return output;
      }),
    ),
    new Promise((_, reject) => signal.addEventListener("abort", reject, { once: true })),
  ] as const);

  return { output, lastId };
}

async function singleStoreHandleEvents(
  store: Store,
  events: JourneyCommittedEvent[],
  indent: number,
  total: number,
  logger: Logger,
  onError: JourneyConfig["onError"],
  signal: AbortSignal,
) {
  const firstId = events[0].id;
  const lastId = events.at(-1)?.id;

  const conclusion = "└";
  const intermediateStep = "├";
  const indentStr = "[HANDLING_EVENT] │ ".repeat(indent);
  const maxLog = Math.log2(events.length) | 0;
  const tab = "..".repeat(3 + Math.max(0, maxLog));
  const I = `${indentStr}${intermediateStep}`;
  const C = `${indentStr}${conclusion}`;
  const T = "└─".repeat(indent); // termination line

  if (indent === 0) {
    const msg =
      lastId === firstId
        ? `${DBG} ${indentStr} ${store.name} is handling event #${firstId}`
        : `${DBG} ${indentStr} ${store.name} is handling events [#${firstId} - #${lastId}]`;
    logger.info(msg);
  }

  try {
    const output = await store.handleEvents(events, signal);

    return output;
  } catch (ex) {
    // if there is only one event, we don't need to bisect
    if (events.length === 1) {
      logger.info(`${INF} ${I} 🔍 Identified offending event:  #${events[0].id} - ${events[0].type}`);
      const resolution = onError(wrapError(ex), events[0]);

      if (resolution === skip) {
        logger.log(`${DBG} ${I} ▶️ Resolution is SKIP .......... MOVE ON!`);
        return [];
      }
      logger.log(`${INF} ${T} 💀 Resolution is not SKIP       STOP WORKER!`);
      throw new UnrecoverableError(events[0]);
    }

    logger.log(`${INF} ${I} 🔴 Encountered error ....${tab} between #${firstId} and #${lastId}`);

    // bisect events
    const mid = Math.floor(events.length / 2);
    const midId = events[mid].id;
    const maxStep = Math.ceil(Math.log2(total));
    const bisectDescription = `step ${indent + 1} of ${maxStep}`;
    logger.debug(`${DBG} ${I} Bisecting: ${bisectDescription}`);
    const left = events.slice(0, mid);
    const right = events.slice(mid);

    // retry left
    try {
      if (left.length === 1) {
        logger.debug(`${DBG} ${I} Retry LEFT ..............${tab} #${firstId} - ${events[0].type}`);
      } else {
        logger.debug(`${DBG} ${I} Retry LEFT ..............${tab} [#${firstId} - #${midId - 1}]`);
      }
      const start = Date.now();
      await singleStoreHandleEvents(store, left, indent + 1, total, logger, onError, signal);
      const end = Date.now();
      logger.log(`${DBG} ${I} 🟢    LEFT SUCCESS (took ${end - start}ms)`);
    } catch (retryEx) {
      // is it recoverable?
      if (retryEx instanceof UnrecoverableError) {
        logger.info(`${INF} ${C} left is unrecoverable`);
        throw retryEx;
      }
    }

    // if left succeeds, retry right
    try {
      if (right.length === 1) {
        logger.info(`${DBG} ${I} Retry RIGHT .............${tab} 1 event on from #${midId}`);
      } else {
        logger.info(`${DBG} ${I} Retry RIGHT .............${tab} [#${midId} - #${lastId}]`);
      }
      const start = Date.now();
      await singleStoreHandleEvents(store, right, indent + 1, total, logger, onError, signal);
      const end = Date.now();
      logger.log(`${DBG} ${I} 🟢 RIGHT SUCCESS (took ${end - start}ms)`);
    } catch (retryEx) {
      // is it recoverable?
      if (retryEx instanceof UnrecoverableError) {
        logger.info(`${INF} ${C} right is unrecoverable`);
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
