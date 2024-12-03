import type skip from "../lib/skip";
import type { Logger } from "./Logger";
import type { JourneyCommittedEvent } from "./events";

export type JourneyConfig<Stores extends Store[] = Store[]> = ServerOrWriteTo & {
  stores: Stores;
  dev?: boolean;
  onError: OnError;
  onReport?: OnReport;
  logger?: Logger;
};

export type ServerOrWriteTo =
  | {
      server: Server;
    }
  | {
      /**
       * @deprecated prefer to use `server` instead
       */
      writeTo: string;
    };

type Server = string | ProtectedServer;

interface ProtectedServer {
  url: string;
  key: string;
  secret: string;
}

interface StoreMeta {
  includes: string[];
}

/**
 * [ReaderIdentifierType, ReaderType]
 * Where:
 * - ReaderIdentifierType is the type of the identifier of the reader.
 * - ReaderType is the type of the reader.
 *
 * This helps journey.getReader() to return the correct type of reader.
 *
 * @example
 * - [number, number]
 * - [MongoDBModel<{id: number}>, Collection<{id: number, name: string, age: number}>]
 */
type ReaderTuple = [unknown, unknown];

/**
 * A store must declare its reader tuple type.
 *
 * @example
 * ```ts
 * interface MyStore extends Store<["key1", "reader 1"] | [123, "reader 2"]> {};
 * // journey.getReader("key1") => "reader 1"
 * // journey.getReader(123) => "reader 2"
 * // journey.getReader("unknown-reader-identifier") => typescript error
 * ```
 */
export interface Store<RT extends ReaderTuple = ReaderTuple> {
  name: string;
  meta: StoreMeta;

  // keep generic type RT from being discarded
  // fixme
  dummyFn?: () => RT;

  /**
   * journey instance will call this method to register models.
   * Registration of a model will tell which store this model belongs to.
   *
   * This is useful when journey.getReader() is called.
   */

  // biome-ignore lint/suspicious/noExplicitAny: Jerni can take any model and store, there is no way to enforce the type here. However, the type of mongodb store is enforced in the store-mongodb package
  registerModels: (map: Map<any, Store>) => void;

  getDriver(model: any): Promise<any>;
  // biome-ignore lint/suspicious/noExplicitAny: the return type is dependent on the implementation of the store
  handleEvents: (events: JourneyCommittedEvent[], signal?: AbortSignal) => Promise<any>;
  getLastSeenId: () => Promise<number>;
  toString(): string;

  listen: () => AsyncGenerator<number, void, unknown>;
  clean: () => Promise<void>;
  dispose: () => Promise<void>;
  isSafeForDev?: () => Promise<boolean>; // old stores do not have this method
}

type OnError =
  | ((error: Error, event: JourneyCommittedEvent) => typeof skip)
  | ((error: Error, event: JourneyCommittedEvent) => void);

type OnReport = (name: string, msg?: unknown) => void;
