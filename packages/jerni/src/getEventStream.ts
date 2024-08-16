import type { URL } from "node:url";
import prettyBytes from "pretty-bytes";
import messageListFromString from "./getMessage";
import type { Logger } from "./types/Logger";
import type { JourneyCommittedEvent } from "./types/events";

function readConfig<T>(key: string, defaultValue: string, transformFn: (value: string) => T): T {
  return transformFn(process.env[key] ?? defaultValue);
}

const IDLE_TIME = readConfig("IDLE_TIME", "30000", Number);
const MAX_IDLE_TIME = readConfig("MAX_IDLE_TIME", "900000", Number);
const BATCH_SIZE = readConfig("BATCH_SIZE", "256", Number);
const MAX_CHUNK_SIZE = readConfig("MAX_CHUNK_SIZE", "1048576", Number);
const MAX_CHUNK_COUNT = readConfig("MAX_BATCH_SIZE", "2000", Number);

const RETRY_TIMES = [10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600];

export default async function getEventStreamFromUrl(
  initialFrom: string,
  url: URL,
  signal: AbortSignal,
  logger: Logger,
) {
  logger.debug("getEventStreamFromUrl", url.toString());
  let currentFrom = initialFrom;
  let retryTime = 10;
  let errorCount = 0;
  let idleTime = IDLE_TIME;
  let batchSize = BATCH_SIZE;
  let wasStoppedByLargeData = false;

  return new ReadableStream<JourneyCommittedEvent[]>({
    async start(controller) {
      while (!signal.aborted) {
        const connectionStart = Date.now();

        try {
          logger.info(
            `connecting to ${url.toString()} from ${currentFrom} | max idle time: ${idleTime}ms | batch size: ${batchSize}`,
          );
          const eventStream = retrieveJourneyCommittedEvents(url, currentFrom, idleTime, batchSize, signal);

          for await (const msg of eventStream) {
            if (msg.type === "connected") {
              errorCount = 0;
              const connectionTime = msg.connected_at - connectionStart;
              logger.log(`connected after ${connectionTime}ms`);
              continue;
            }

            if (msg.type === "idle") {
              logger.log(`idle for ${msg.idle_period}ms`);
              // double the idle time, but not more than 15 minutes
              idleTime = Math.min(idleTime * 2, MAX_IDLE_TIME);
              break;
            }

            if (msg.type === "too_large") {
              if (batchSize === 1) {
                logger.error("data is too large, but already at minimum batch size");
                process.exit(1);
              }

              logger.log("data is too large");
              if (msg.count > MAX_CHUNK_COUNT) {
                logger.log("pending chunk count %s", msg.count);
              } else {
                logger.log("pendingSize %s", prettyBytes(msg.size));
              }

              batchSize = Math.max(1, Math.floor(batchSize / 2));
              logger.log(`data is too large, reduce batch size to ${batchSize}`);
              wasStoppedByLargeData = true;
              break;
            }

            const eventBatch = msg.events;

            const lastEvent = eventBatch.at(-1);
            if (lastEvent) {
              // reset idle time
              idleTime = IDLE_TIME;
              currentFrom = String(lastEvent.id);
              controller.enqueue(eventBatch);
            }

            // if things go back to normal, reset the batch size
            if (wasStoppedByLargeData) {
              logger.info("data is back to normal, reset batch size top 200");
              wasStoppedByLargeData = false;
              batchSize = BATCH_SIZE;
              break;
            }
          }

          // has returned due to inactivity
          retryTime = 10;
          logger.log("reconnect due to inactivity");
        } catch (ex) {
          errorCount++;
          retryTime = RETRY_TIMES[errorCount] ?? RETRY_TIMES.at(-1);
          logger.error("reconnect due to error", ex);
        }

        await Bun.sleep(retryTime);
      }
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
      type: "event";
      events: JourneyCommittedEvent[];
    };

async function* retrieveJourneyCommittedEvents(
  url: URL,
  lastSeenId: string,
  idleTime: number,
  batchSize: number,
  signal: AbortSignal,
): AsyncGenerator<EventStreamReturnType, void, unknown> {
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

    const stream = resp.body;

    const pending = [] as string[];

    const decoder = new TextDecoder();

    let timeSinceLastData = Date.now();

    let pendingSize = 0;
    let incomingChunkCountBeforeAFullMessage = 0;

    // read the body
    for await (const chunk of stream) {
      const utf8 = decoder.decode(chunk, { stream: true });
      const utf8Size = utf8.length;
      pendingSize += utf8Size;

      pending.push(utf8);

      const r = messageListFromString(pending.join(""));

      pending[0] = r.leftoverData;
      pending.length = 1;

      if (pendingSize > 0) {
        incomingChunkCountBeforeAFullMessage++;
      }

      const events = r.messages.flatMap((message) => {
        if (message.event === "INCMSG") {
          return JSON.parse(message.data) as JourneyCommittedEvent[];
        }

        return [];
      });

      if (events.length > 0) {
        yield {
          type: "event",
          events,
        };
        timeSinceLastData = Date.now();
        incomingChunkCountBeforeAFullMessage = 0;
      }

      // data is too large
      const isTooLarge = pendingSize > MAX_CHUNK_SIZE || incomingChunkCountBeforeAFullMessage > MAX_CHUNK_COUNT;
      if (isTooLarge) {
        yield {
          type: "too_large",
          size: pendingSize,
          count: incomingChunkCountBeforeAFullMessage,
        };
      }

      // reset pending size
      pendingSize = r.leftoverData.length;
      console.log("pendingSize after reset %s", prettyBytes(pendingSize));

      const elapsed = Date.now() - timeSinceLastData;
      if (elapsed > idleTime) {
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
