import type { JourneyConfig } from "./config";
import type {
  JourneyCommittedEvent,
  JourneyCommittedEvents,
  TypedJourneyCommittedEvent,
  TypedJourneyEvent,
} from "./events";

export interface JourneyInstance {
  /**
   * @deprecated use `append` instead
   * @param event uncommitted event
   */
  commit<P extends keyof JourneyCommittedEvents>(event: TypedJourneyEvent<P>): Promise<TypedJourneyCommittedEvent<P>>;

  append<P extends keyof JourneyCommittedEvents>(event: TypedJourneyEvent<P>): Promise<TypedJourneyCommittedEvent<P>>;

  waitFor(event: JourneyCommittedEvent, timeoutOrSignal?: number | AbortSignal): Promise<void>;

  getReader: GetReaderFn;

  getConfig: () => JourneyConfig;
}

// placeholder for getReader function
// biome-ignore lint/suspicious/noExplicitAny: because this is a placeholder, the client that uses jerni would override this type
export type GetReaderFn = (model: any) => Promise<any>;
