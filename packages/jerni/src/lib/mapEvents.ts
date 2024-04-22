import { JourneyCommittedEvent, LocalEvents } from "./exported_types";

interface MapEventsReturnType<OperationTypes> {
  (event: JourneyCommittedEvent): OperationTypes[];
}

const metaMap = new WeakMap<Function, MetaIncludes>();

interface MetaIncludes {
  // only include those event names when sending query or subscribe
  includes: string[];
}

type EventSpecificHandler<EventType, EventPayload, ReturnType> = (event: {
  id: number;
  type: EventType;
  payload: Exclude<EventPayload, undefined>;
}) => ReturnType | ReturnType[] | void;

type EventsMapInput<EventTypes, ReturnType> = {
  [key in keyof EventTypes]: EventSpecificHandler<
    key,
    EventTypes[key],
    ReturnType
  >;
};

export default function mapEvents<ReturnType, EventTypes = LocalEvents>(
  eventsMap: EventsMapInput<Partial<EventTypes>, ReturnType>,
): MapEventsReturnType<ReturnType>;

export default function mapEvents(eventsMap: any): any {
  const meta = {
    includes: Object.keys(eventsMap),
  };

  function transform(event: any) {
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

  metaMap.set(transform, meta);
  return new Proxy(transform, {
    get(target, prop: keyof typeof transform) {
      if (prop === "meta") {
        return meta;
      }

      return target[prop];
    },
  });
}
