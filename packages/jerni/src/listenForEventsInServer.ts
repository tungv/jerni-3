import { EventSourcePlus } from "event-source-plus";
import { URL } from "node:url";
import type { Logger } from "./types/Logger";

const HIGH_WATER_MARK = 1000000; // 1,000,000
const LOW_WATER_MARK = 100000; // 100,000

function startListening(
  subscriptionUrl: URL,
  eventsBuffer: string[],
  resolvePromise: (value?: unknown) => void,
  stop: (stopAtEventId: string) => void,
  logger: Logger,
) {
  const eventSource = new EventSourcePlus(subscriptionUrl.toString(), {
    headers: {
      authorization: `Basic ${btoa(`${subscriptionUrl.username}:${subscriptionUrl.password}`)}`,
      "burst-count": "200",
    },
  });

  const controller = eventSource.listen({
    onMessage(message) {
      if (message.event === "INCMSG") {
        eventsBuffer.push(message.data);
        resolvePromise();

        const bufferSize = eventsBuffer.reduce((acc, event) => acc + event.length, 0);

        if (bufferSize > HIGH_WATER_MARK) {
          logger.info(`Buffer is full, stop listening at event id ${message.id}, size: ${bufferSize}`);
          controller.abort();
          stop(message.id ?? "0");
        }
      }
    },
    onRequest(context) {
      // check if the last event id in the header or query is higher, then we should set the last event id in header to that
      const stringHeaderLastEventId = context.options.headers
        ? (context.options.headers as Record<string, string>)["Last-Event-ID"]
        : null;
      const headerLastEventId = stringHeaderLastEventId ? Number.parseInt(stringHeaderLastEventId) : 0;
      const url = new URL(context.request);
      const stringQueryLastEventId = url.searchParams.get("lastEventId");
      const queryLastEventId = stringQueryLastEventId ? Number.parseInt(stringQueryLastEventId) : 0;

      const lastEventId = Math.max(headerLastEventId, queryLastEventId);
      context.options.headers = {
        ...context.options.headers,
        "Last-Event-ID": lastEventId.toString(),
      };

      // also remove the last event id from the search params
      url.searchParams.delete("lastEventId");
      context.request = url.toString();
    },
    onResponseError(responseError) {
      console.log({ responseError });
    },
  });

  return controller;
}

export default async function* listenForEventsInServer(
  subscriptionUrl: URL,
  signal: AbortSignal,
  logger: Logger,
): AsyncGenerator<string> {
  const { promise: initialPromise, resolve: initialResolve } = Promise.withResolvers();

  let unResolvedPromise = initialPromise;
  let resolver = initialResolve;
  let hasStopped = false;

  function stop(stopAtEventId: string) {
    // should continue from the next event after stopping
    const newLastEventId = String(Number(stopAtEventId) + 1);
    subscriptionUrl.searchParams.set("lastEventId", newLastEventId);
    hasStopped = true;
  }
  function resolvePromise() {
    resolver();
  }

  const eventsBuffer: string[] = [];

  let controller = startListening(subscriptionUrl, eventsBuffer, resolvePromise, stop, logger);

  signal.addEventListener(
    "abort",
    () => {
      controller.abort();
      resolver();
    },
    { once: true },
  );

  while (!signal.aborted) {
    const data = eventsBuffer.shift();
    if (data) {
      const bufferSize = eventsBuffer.reduce((acc, event) => acc + event.length, 0);

      if (hasStopped && bufferSize < LOW_WATER_MARK) {
        logger.info("Buffer is low, start listening again");
        hasStopped = false;
        controller = startListening(subscriptionUrl, eventsBuffer, resolvePromise, stop, logger);
      }

      yield data;

      continue;
    }

    await unResolvedPromise;

    if (signal.aborted) {
      break;
    }

    const { promise, resolve } = Promise.withResolvers();
    unResolvedPromise = promise;
    resolver = resolve;
  }
}
