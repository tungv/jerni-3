import JerniPersistenceError from "../JerniPersistenceError";
import type { JourneyTestInstance } from "../types/JourneyTestInstance";
import type {
  CommittingEventDefinitions,
  JourneyCommittedEvent,
  LocalEvents,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "../types/events";
import type { JourneyInstance } from "../types/journey";

export default async function testWrapper(
  jerni: JourneyInstance,
  initialEvents: ToBeCommittedJourneyEvent[] = [],
): Promise<JourneyTestInstance> {
  // override the default implementation of `jerni.commit` and `jerni.append`
  // add 1 more method to the journey instance: waitAll
  // add 1 more field to the journey instance: committed

  const config = jerni.getConfig();
  const events = initialEvents.map((event, index) => ({
    ...event,
    id: index + 1,
  }));

  // project all the initial events if any
  if (events.length > 0) {
    for (const store of config.stores) {
      await store.handleEvents(events);
    }
  }

  async function handleEvent<P extends keyof LocalEvents>(
    event: ToBeCommittedJourneyEvent<keyof CommittingEventDefinitions>,
  ): Promise<TypedJourneyCommittedEvent<P>> {
    const withId: JourneyCommittedEvent = {
      ...event,
      id: events.length + 1,
    };

    events.push(withId);

    scheduleFlush(withId);

    return withId as TypedJourneyCommittedEvent<P>;
  }

  const flushQueue: JourneyCommittedEvent[] = []; // queue of events to be flushed
  function scheduleFlush(event: JourneyCommittedEvent) {
    // enqueue the event
    flushQueue.push(event);

    // Schedule the flush if this is the first event in the queue.
    // Subsequent events will be flushed in the same flush().
    // Once flush() is done, it will clear the queue, allowing the next round of flush() scheduling.
    if (flushQueue.length === 1) {
      process.nextTick(flush);
    }
  }

  let lastProjectedEventId = 0; // id of the last projected event
  let isFlushing = false; // flag to indicate if a flush is in progress
  async function flush() {
    // if a flush is already in progress, reschedule this flush.
    if (isFlushing) {
      // Don't use process.nextTick() to avoid infinite loop
      setImmediate(flush);
      return;
    }

    isFlushing = true;

    const eventsToFlush = [...flushQueue];
    flushQueue.length = 0; // clear the queue for the next round of flush() scheduling

    // project the events
    for (const store of config.stores) {
      await store.handleEvents(eventsToFlush);
    }
    // update the last projected event id
    lastProjectedEventId = eventsToFlush.at(-1)!.id;

    isFlushing = false;
  }

  async function waitForEvent(event: JourneyCommittedEvent, timeout: number, elapsed: number = 0) {
    const start = Date.now();
    // check if the event is already projected
    if (event.id <= lastProjectedEventId) return;

    // check if the timeout is reached
    if (elapsed >= timeout) throw new JerniPersistenceError(event, timeout);

    // wait for the event to be projected in 10ms
    await new Promise((resolve) => setTimeout(resolve, 10));

    // calculate the cumulative elapsed time
    const cumulativeElapsed = elapsed + Date.now() - start;

    // recursively wait for the event to be projected
    return waitForEvent(event, timeout, cumulativeElapsed);
  }

  async function waitAll() {
    // wait for the latest event to be projected
    const latestEvent = events.at(-1);

    if (!latestEvent) {
      console.warn("journey.waitAll() without any committed events");
      return;
    }

    return waitForEvent(latestEvent, 3000);
  }

  return {
    append: handleEvent,
    commit: handleEvent,
    getConfig: jerni.getConfig,
    getReader: jerni.getReader,
    waitFor: (event, timeoutOrSignal) => {
      if (typeof timeoutOrSignal === "number") {
        return waitForEvent(event, timeoutOrSignal);
      }
      if (typeof timeoutOrSignal === "undefined") {
        return waitForEvent(event, 3000);
      }
      // fallback to the default implementation
      // todo: handle the abort signal
      return jerni.waitFor(event, timeoutOrSignal);
    },
    dispose: jerni.dispose,
    waitAll,
    committed: events,
  };
}
