import type { URL } from "node:url";
import messageListFromString from "./getMessage";
import type { Logger } from "./types/Logger";
import type { JourneyCommittedEvent } from "./types/events";

const THIRTY_SECONDS = 30 * 1000;

const RETRY_TIMES = [10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600];

export default async function getEventStreamFromUrl(
  initialFrom: string,
  url: URL,
  signal: AbortSignal,
  logger: Logger,
) {
  console.log("getEventStreamFromUrl", url.toString());
  let currentFrom = initialFrom;
  let retryTime = 10;
  let errorCount = 0;
  let idleTime = THIRTY_SECONDS;

  return new ReadableStream<JourneyCommittedEvent[]>({
    async start(controller) {
      while (!signal.aborted) {
        const connectionStart = Date.now();
        try {
          const eventStream = retrieveJourneyCommittedEvents(url, currentFrom, idleTime, signal);

          for await (const msg of eventStream) {
            if (msg.type === "connected") {
              errorCount = 0;
              const connectionTime = msg.connected_at - connectionStart;
              logger.log(`connected after ${connectionTime}ms`);
              continue;
            }

            if (msg.type === "idle") {
              logger.log(`idle for ${msg.idle_period}ms`);
              // double the idle time
              idleTime *= 2;
              break;
            }

            const eventBatch = msg.events;

            const lastEvent = eventBatch.at(-1);
            if (lastEvent) {
              // reset idle time
              idleTime = THIRTY_SECONDS;
              currentFrom = String(lastEvent.id);
              controller.enqueue(eventBatch);
            }
          }

          // has returned due to counterBeforeReset
          retryTime = 10;
          logger.log("reconnect due to inactivity");
        } catch (ex) {
          errorCount++;
          retryTime = RETRY_TIMES[errorCount] ?? RETRY_TIMES.at(-1);
          logger.error("reconnect due to error", ex);
        }

        Bun.gc(false);
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
      type: "event";
      events: JourneyCommittedEvent[];
    };

async function* retrieveJourneyCommittedEvents(
  url: URL,
  lastSeenId: string,
  idleTime: number,
  signal: AbortSignal,
): AsyncGenerator<EventStreamReturnType, void, unknown> {
  try {
    const resp = await fetch(url.toString(), {
      headers: {
        authorization: `Basic ${btoa(`${url.username}:${url.password}`)}`,
        "burst-count": "200",
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

    let pending = "";

    const decoder = new TextDecoder();

    let timeSinceLastData = Date.now();

    // read the body
    for await (const chunk of stream) {
      const utf8 = decoder.decode(chunk, { stream: true });
      pending += utf8;

      const r = messageListFromString(pending);

      pending = r.leftoverData;

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
      }

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
