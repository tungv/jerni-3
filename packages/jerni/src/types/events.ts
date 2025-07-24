export type JourneyEvent<Payload = unknown, Metadata = unknown> = {
  type: string;
  payload: Payload;
  meta?: Metadata;
};

export type JourneyCommittedEvent<Payload = unknown, Metadata = unknown> = {
  id: number;
  type: string;
  payload: Payload;
  meta?: Metadata;
};

export type ToBeCommittedJourneyEvent<
  Type extends keyof LocalEvents = keyof LocalEvents,
  Payload = LocalEvents[Type],
  Metadata = unknown,
> = {
  type: Type;
  payload: Payload;
  meta?: Metadata;
};

export type TypedJourneyCommittedEvent<
  Type extends keyof LocalEvents = keyof LocalEvents,
  Payload = LocalEvents[Type],
  Metadata = unknown,
> = {
  id: number;
  type: Type;
  payload: Payload;
  meta?: Metadata;
};

// biome-ignore lint/suspicious/noEmptyInterface: allow user to extend this interface
export interface CommittingEventDefinitions {}

// biome-ignore lint/suspicious/noEmptyInterface: allow user to extend this interface
export interface SubscribingEventDefinitions {}
export interface LocalEvents extends CommittingEventDefinitions, SubscribingEventDefinitions {}
