import type { LocalEvents, TypedJourneyCommittedEvent } from "../types/events";

type EventsMapInput<ReturnType> = {
  [key in keyof Partial<LocalEvents>]: (
    event: TypedJourneyCommittedEvent<key>,
  ) => ReturnType | ReturnType[] | undefined;
};

type AnyCommittedEvent = { id: number; type: string; payload: unknown; meta?: unknown };

type AnyHandler<ReturnType> = (event: AnyCommittedEvent) => ReturnType[];

export default function mapEvent<ReturnType>(eventsMap: EventsMapInput<ReturnType>): AnyHandler<ReturnType> {
  const meta = {
    includes: Object.keys(eventsMap),
  };

  function transform(event: AnyCommittedEvent): ReturnType[] {
    const eventType = event.type;

    if (eventType in eventsMap === false) {
      return [];
    }

    // dangerous type casting
    // in runtime, eventsMap may contain more keys than LocalEvents
    // or the values may not be a function
    const handler = eventsMap[eventType as keyof typeof eventsMap] as AnyHandler<ReturnType>;

    // thus we need to check it here to avoid runtime error
    if (typeof handler !== "function") {
      return [];
    }

    const result = handler(event);

    if (!result) {
      return [];
    }

    if (Array.isArray(result)) {
      return result.filter((x) => x);
    }

    return [result];
  }

  return new Proxy(transform, {
    get(target, prop: keyof typeof transform) {
      if (prop === "meta") {
        return meta;
      }

      return target[prop];
    },
  });
}
