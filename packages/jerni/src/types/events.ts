export type JourneyEvent<Payload = unknown, Metadata = unknown> = {
  type: string;
  payload: Payload;
  meta?: Metadata;
};

export type JourneyCommittedEvent<
  EventType extends keyof JourneyCommittedEvents = keyof JourneyCommittedEvents,
  Payload = JourneyCommittedEvents[EventType],
  Metadata = unknown,
> = {
  id: number;
  type: EventType;
  payload: Payload;
  meta?: Metadata;
};

export type TypedJourneyEvent<
  Type extends keyof LocalEvents = keyof LocalEvents,
  Payload = LocalEvents[Type],
  Metadata = unknown,
> = {
  type: Type;
  payload: Payload;
  meta?: Metadata;
};

export type TypedJourneyCommittedEvent<
  Type extends keyof JourneyCommittedEvents = keyof JourneyCommittedEvents,
  Payload = JourneyCommittedEvents[Type],
  Metadata = unknown,
> = {
  id: number;
  type: Type;
  payload: Payload;
  meta?: Metadata;
};

export type JourneyCommittedEvents = {
  [key: string]: unknown;
};
export type JourneySubscribedEvents = {
  [key: string]: unknown;
};
export interface LocalEvents extends JourneyCommittedEvents, JourneySubscribedEvents {}
