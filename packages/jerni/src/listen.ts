import type MyEventSource from "./MyEventSource";

export default async function* listen(
  e: MyEventSource,
  eventName: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const data: string[] = [];

  const unResolvedPromises: Array<(value: unknown) => void> = [];

  const listener = (event: MessageEvent<string>) => {
    data.push(event.data);

    // resolve the pending promises in the while loop so it resolve the data
    resolveAll();
  };

  function onEnd() {
    // resolve the pending promises in while loop so it read the signal.aborted condition
    resolveAll();
  }

  function resolveAll() {
    while (unResolvedPromises.length > 0) unResolvedPromises.shift()?.(1);
  }

  signal?.addEventListener("abort", onEnd, { once: true });

  e.addEventListener(eventName, listener, { signal });

  try {
    // if the signal is aborted, the loop will break
    // otherwise, it will wait for the event to be emitted
    while (!signal?.aborted) {
      if (data.length > 0) {
        const value = data.shift();

        if (value === undefined) {
          continue;
        }

        yield value;
      } else {
        const { promise, resolve } = Promise.withResolvers();
        unResolvedPromises.push(resolve);

        await promise;
      }
    }
  } finally {
    e.removeEventListener(eventName, listener);
    signal?.removeEventListener("abort", onEnd);
  }
}
