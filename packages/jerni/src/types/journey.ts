import type { JourneyConfig, ReaderTuple } from "./config";
import type {
  CommittingEventDefinitions,
  JourneyCommittedEvent,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "./events";

export interface JourneyInstance<Config extends JourneyConfig, RT extends ReaderTuple> {
  /**
   * @deprecated use `append` instead
   * @param event uncommitted event
   */
  commit<P extends keyof CommittingEventDefinitions>(
    event: ToBeCommittedJourneyEvent<P>,
  ): Promise<TypedJourneyCommittedEvent<P>>;

  append<P extends keyof CommittingEventDefinitions>(
    event: ToBeCommittedJourneyEvent<P>,
  ): Promise<TypedJourneyCommittedEvent<P>>;

  waitFor(event: JourneyCommittedEvent, timeoutOrSignal?: number | AbortSignal): Promise<void>;

  getReader: <Tuple extends RT, ReaderIdentifier extends Tuple[0]>(
    identifier: ReaderIdentifier,
  ) => Promise<Tuple extends [ReaderIdentifier, infer Reader] ? Reader : never>;

  getConfig: () => Config;

  dispose: () => Promise<void>;
}

// placeholder for getReader function
export interface GetReaderFn {
  // biome-ignore lint/style/useShorthandFunctionType: this need to be a interface so that it can be augmented
  // biome-ignore lint/suspicious/noExplicitAny: because this is a placeholder, the client that uses jerni would override this type
  (model: any): Promise<any>;
}
