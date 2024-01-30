import skip from "src/lib/skip";
import { Logger } from "./Logger";
import { JourneyCommittedEvent } from "./events";

export type JourneyConfig = ServerOrWriteTo & {
  stores: Store[];
  dev?: boolean;
  onError: OnError;
  onReport: OnReport;
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

export interface Store {
  name: string;
  meta: StoreMeta;

  /**
   * journey instance will call this method to register models.
   * Registration of a model will tell which store this model belongs to.
   *
   * This is useful when journey.getReader() is called.
   */
  registerModels: (
    map: Map<
      {
        name: string;
        version: string;
      },
      Store
    >,
  ) => void;

  getDriver(model: any): any;
  handleEvents: (events: JourneyCommittedEvent[]) => Promise<any>;
  getLastSeenId: () => Promise<number>;
  toString(): string;

  listen: () => AsyncGenerator<number, void, unknown>;
  clean: () => Promise<void>;
  dispose: () => Promise<void>;
}

interface OnError {
  (error: Error, event: JourneyCommittedEvent): undefined | typeof skip;
}

interface OnReport {
  (name: string, msg?: any): void;
}
