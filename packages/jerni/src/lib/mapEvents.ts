import type { JourneyCommittedEvent, LocalEvents } from "./exported_types";

type MapEventsReturnType<OperationTypes> = (event: JourneyCommittedEvent) => OperationTypes[];

type EventSpecificHandler<ReturnType> = (event: JourneyCommittedEvent) => ReturnType | ReturnType[] | undefined;

type EventsMapInput<ReturnType> = {
  [key in keyof Partial<LocalEvents>]: EventSpecificHandler<ReturnType>;
};

export default function mapEvents<ReturnType>(eventsMap: EventsMapInput<ReturnType>): MapEventsReturnType<ReturnType>;

export default function mapEvents<ReturnType>(eventsMap: EventsMapInput<ReturnType>): MapEventsReturnType<ReturnType> {
  const meta = {
    includes: Object.keys(eventsMap),
  };

  function transform(event: JourneyCommittedEvent) {
    const eventType = event.type as keyof typeof eventsMap;
    const handler = eventsMap[eventType];
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
