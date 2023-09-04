export type JourneyEvent<Payload = any, Metadata = any> = {
  type: string;
  payload: Payload;
  meta?: Metadata;
};

export type JourneyCommittedEvent<Payload = any, Metadata = any> = {
  id: number;
  type: string;
  payload: Payload;
  meta?: Metadata;
};

export type TypedJourneyEvent<
  Type extends string = string,
  Payload = any,
  Metadata = any,
> = {
  type: Type;
  payload: Payload;
  meta?: Metadata;
};

export type TypedJourneyCommittedEvent<
  Type extends string = string,
  Payload = any,
  Metadata = any,
> = {
  id: number;
  type: Type;
  payload: Payload;
  meta?: Metadata;
};

export interface JourneyCommittedEvents {}
export interface JourneySubscribedEvents {}
export interface LocalEvents
  extends JourneyCommittedEvents,
    JourneySubscribedEvents {}
