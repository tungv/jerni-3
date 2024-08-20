import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { DBG, ERR, INF } from "./cli-utils/log-headers";
import {
  INITIAL_IDLE_TIME,
  INITIAL_PULSE_COUNT,
  MAX_IDLE_TIME,
  MAX_STREAMING_BUFFER_COUNT,
  MAX_STREAMING_BUFFER_SIZE,
} from "./constants";
import messageListFromString from "./getMessage";
import formatUrl from "./lib/formatUrl";
import type { EventDatabase } from "./sqlite";
import type { Logger } from "./types/Logger";

declare global {
  // biome-ignore lint/suspicious/noExplicitAny: explicit any is needed here
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
  }
}

const RETRY_TIMES = [10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600];

export default async function getEventStreamFromUrl(
  initialFrom: string,
  url: URL,
  db: EventDatabase,
  signal: AbortSignal,
  logger: Logger,
) {
  const safeUrlString = formatUrl(url);
  let currentFrom = initialFrom;
  let retryTime = 10;
  let errorCount = 0;
  let idleTime = INITIAL_IDLE_TIME;
  let batchSize = INITIAL_PULSE_COUNT;
  let wasStoppedByLargeData = false;

  return new ReadableStream<number>({
    async start(controller) {
      while (!signal.aborted) {
        const connectionStart = Date.now();

        try {
          logger.info(
            `${INF} [DOWNLOADING_EVENT] connecting to ${safeUrlString} from ${currentFrom} | max idle time: ${idleTime}ms | batch size: ${batchSize}`,
          );
          const eventStream = retrieveJourneyCommittedEvents(url, currentFrom, idleTime, batchSize, db, signal);

          for await (const msg of eventStream) {
            if (msg.type === "connected") {
              errorCount = 0;
              const connectionTime = msg.connected_at - connectionStart;
              logger.log(`${DBG} [DOWNLOADING_EVENT] connected after ${prettyMilliseconds(connectionTime)}`);
              continue;
            }

            if (msg.type === "idle") {
              logger.info(`${INF} [DOWNLOADING_EVENT] idle for ${prettyMilliseconds(msg.idle_period)}`);
              // double the idle time, but not more than 15 minutes
              idleTime = Math.min(idleTime * 2, MAX_IDLE_TIME);
              break;
            }

            if (msg.type === "too_large") {
              if (batchSize === 1) {
                logger.error(`${ERR} [DOWNLOADING_EVENT] data is too large, but already at minimum batch size`);
                process.exit(1);
              }

              logger.info(`${INF} [DOWNLOADING_EVENT] data is too large`);
              if (msg.count > MAX_STREAMING_BUFFER_COUNT) {
                logger.debug(`${DBG} [DOWNLOADING_EVENT] pending chunk count ${msg.count}`);
              } else {
                logger.debug(`${DBG} [DOWNLOADING_EVENT] pending chunk size ${prettyBytes(msg.size)}`);
              }

              batchSize = Math.max(1, Math.floor(batchSize / 2));
              logger.info(`${INF} [DOWNLOADING_EVENT] reduce batch size to ${batchSize}`);
              wasStoppedByLargeData = true;
              break;
            }

            // enqueue and reset
            controller.enqueue(msg.lastId);
            idleTime = INITIAL_IDLE_TIME;
            currentFrom = String(msg.lastId);

            // if things go back to normal, reset the batch size
            if (wasStoppedByLargeData) {
              logger.info(`${INF} [DOWNLOADING_EVENT] reset batch size to ${INITIAL_PULSE_COUNT}`);
              wasStoppedByLargeData = false;
              batchSize = INITIAL_PULSE_COUNT;
              break;
            }
          }

          // has returned due to inactivity
          retryTime = 10;
          if (wasStoppedByLargeData) {
            logger.info(`${INF} [DOWNLOADING_EVENT] reconnect due to data overflow`);
          } else {
            logger.info(`${INF} [DOWNLOADING_EVENT] reconnect due to inactivity`);
          }
        } catch (ex) {
          // check if the error is due to abort signal
          // immediately terminate the stream if signal is aborted
          if (signal.aborted) {
            logger.info(`${INF} [DOWNLOADING_EVENT] terminating ReadableStream due to AbortSignal`);
            break;
          }

          errorCount++;
          retryTime = RETRY_TIMES[errorCount] ?? RETRY_TIMES.at(-1);
          logger.error(`${ERR} [DOWNLOADING_EVENT] error occurred ${errorCount} times.`);
          logger.debug({ downloading_event_error: ex });
          logger.error(`${ERR} [DOWNLOADING_EVENT] retry in ${retryTime}s`);
        }

        await Bun.sleep(retryTime);
      }

      controller.close();
    },
  });
}

type EventStreamReturnType =
  | {
      type: "connected";
      connected_at: number;
    }
  | {
      type: "idle";
      idle_period: number;
    }
  | {
      type: "too_large";
      size: number;
      count: number;
    }
  | {
      type: "incoming_message";
      lastId: number;
    };

async function* retrieveJourneyCommittedEvents(
  url: URL,
  lastSeenId: string,
  idleTime: number,
  batchSize: number,
  db: EventDatabase,
  signal: AbortSignal,
): AsyncGenerator<EventStreamReturnType, void, unknown> {
  signal.throwIfAborted();
  try {
    const resp = await fetch(url.toString(), {
      headers: {
        authorization: `Basic ${btoa(`${url.username}:${url.password}`)}`,
        "burst-count": String(batchSize),
        "last-event-id": lastSeenId,
      },
      signal,
    });

    if (!resp.ok) {
      throw new Error("failed to fetch");
    }

    if (!resp.body) {
      throw new Error("response body is empty");
    }

    yield {
      type: "connected" as const,
      connected_at: Date.now(),
    };

    const stream = resp.body.pipeThrough(new TextDecoderStream());

    const pending = [] as string[];

    let timeSinceLastData = Date.now();

    let pendingSize = 0;
    let incomingChunkCountBeforeAFullMessage = 0;

    // read the body
    for await (const utf8 of stream) {
      const utf8Size = utf8.length;
      pendingSize += utf8Size;

      pending.push(utf8);

      const r = messageListFromString(pending.join(""));

      pending[0] = r.leftoverData;
      pending.length = 1;

      if (pendingSize > 0) {
        incomingChunkCountBeforeAFullMessage++;
        if (incomingChunkCountBeforeAFullMessage > 10 && pendingSize > 1024) {
          const size = prettyBytes(pendingSize);
          const max = prettyBytes(MAX_STREAMING_BUFFER_SIZE);
          const progress = Math.min(1, pendingSize / MAX_STREAMING_BUFFER_SIZE);
          const bar = "#".repeat(progress * 80).padEnd(80, "_");
          console.log(`[DOWNLOADING] from: #${lastSeenId}/size=${batchSize} buffer: [${bar}] (${size} / ${max})`);
        }
      }

      const messages = r.messages.flatMap((message) => {
        if (message.event === "INCMSG") {
          return message;
        }

        return [];
      });

      if (messages.length > 0) {
        // biome-ignore lint/style/noNonNullAssertion: messages.length > 0
        const lastMessage = messages.at(-1)!;

        db.persistBatch(messages);
        yield {
          type: "incoming_message",
          lastId: Number.parseInt(lastMessage.id, 10),
        };
        timeSinceLastData = Date.now();
        incomingChunkCountBeforeAFullMessage = 0;
      }

      // data is too large
      const isTooLarge =
        pendingSize > MAX_STREAMING_BUFFER_SIZE || incomingChunkCountBeforeAFullMessage > MAX_STREAMING_BUFFER_COUNT;
      if (isTooLarge) {
        yield {
          type: "too_large",
          size: pendingSize,
          count: incomingChunkCountBeforeAFullMessage,
        };
      }

      // reset pending size
      pendingSize = r.leftoverData.length;

      const elapsed = Date.now() - timeSinceLastData;
      if (elapsed > idleTime && pendingSize === 0) {
        yield {
          type: "idle",
          idle_period: elapsed,
        };
      }
    }
  } finally {
    Bun.gc(true);
  }
}
