import type { JourneyTestInstance } from "../types/JourneyTestInstance";
import type {
  CommittingEventDefinitions,
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

  async function handleEvent<P extends keyof CommittingEventDefinitions>(
    event: ToBeCommittedJourneyEvent<keyof CommittingEventDefinitions>,
  ): Promise<TypedJourneyCommittedEvent<P>> {
    const withId = {
      ...event,
      id: events.length + 1,
    };

    events.push(withId);

    for (const store of config.stores) {
      await store.handleEvents([withId]);
    }

    return withId as TypedJourneyCommittedEvent<P>;
  }

  return {
    append: handleEvent,
    commit: handleEvent,
    getConfig: jerni.getConfig,
    getReader: jerni.getReader,
    waitFor: jerni.waitFor,
    async waitAll() {
      // place holder only, the way current append and commit work, all the events are already processed
    },
    committed: events,
  };
}
