import {
  JourneyEvent,
  JourneyCommittedEvent,
  TypedJourneyCommittedEvent,
} from "./events";

import { LocalEvents } from "../lib/exported_types";

export interface JourneyInstance {
  /**
   * @deprecated use `append` instead
   * @param event uncommitted event
   */
  commit<P extends Record<string, any>, M = unknown>(
    event: JourneyEvent<P, M>,
  ): Promise<JourneyCommittedEvent<P, M>>;

  append<T extends keyof LocalEvents, M = unknown>(event: {
    type: T;
    payload: LocalEvents[T];
    meta?: M;
  }): Promise<
    TypedJourneyCommittedEvent<Exclude<T, number>, LocalEvents[T], M>
  >;

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
