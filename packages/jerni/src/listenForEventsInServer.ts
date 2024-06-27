import type { EventSourcePlus } from "event-source-plus";

export default async function* listenForEventsInServer(
  eventSource: EventSourcePlus,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const { promise: initialPromise, resolve: initialResolve } = Promise.withResolvers();

  let unResolvedPromise = initialPromise;
  let resolver = initialResolve;

  const eventsBuffer: string[] = [];

  const controller = eventSource.listen({
    onMessage(message) {
      if (message.event === "INCMSG") {
        eventsBuffer.push(message.data);
        resolver();
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
