import { JourneyEvent, JourneyCommittedEvent } from "./events";

export interface JourneyInstance {
  commit<P extends Record<string, any>, M = unknown>(
    event: JourneyEvent<P, M>,
  ): Promise<JourneyCommittedEvent<P, M>>;

  waitFor<P = any, M = undefined>(
    event: JourneyCommittedEvent<P, M>,
  ): Promise<void>;
  getReader: GetReaderFn;
  dispose: () => Promise<void>;

  // async generator `begin` that start the subscription
  begin: (signal: AbortSignal) => AsyncGenerator<JourneyCommittedEvent[]>;
}

export interface GetReaderFn {
  // placeholder for getReader function
  (model: any): Promise<any>;
}
