import type { JourneyConfig, Store } from "./config";
import type {
  CommittingEventDefinitions,
  JourneyCommittedEvent,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "./events";

type ExtractReaderIdentifiersFromStores<Stores extends Store[]> = Stores[number] extends Store<infer RT>
  ? RT[0]
  : never;

export interface JourneyInstance<Config extends JourneyConfig> {
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

  getReader: <ReaderIdentifier extends ExtractReaderIdentifiersFromStores<Config["stores"]>>(
    identifier: ReaderIdentifier,
  ) => Config["stores"][number] extends Store<infer RT>
    ? RT extends [ReaderIdentifier, infer Reader]
      ? Reader
      : never
    : never;

  getConfig: () => Config;

  dispose: () => Promise<void>;
}

// placeholder for getReader function
export interface GetReaderFn {
  // biome-ignore lint/style/useShorthandFunctionType: this need to be a interface so that it can be augmented
  // biome-ignore lint/suspicious/noExplicitAny: because this is a placeholder, the client that uses jerni would override this type
  (model: any): Promise<any>;
}
