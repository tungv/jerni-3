import { MongoDBModel, makeMongoDBStore } from "@jerni/store-mongodb";
import { describe, it, expect } from "bun:test";
import createServer from "src/events-server";
import { MongoClient } from "mongodb";
import initJourney from "../makeTestJourney";
import startWorker from "../startWorker";
import mapEvents from "jerni/lib/mapEvents";
import { JourneyCommittedEvent } from "@jerni/store-mongodb/lib/src/types";
import JerniPersistenceError from "jerni/lib/errors/JerniPersistenceError";

declare module "jerni/type" {
  export interface LocalEvents {
    FAILURE_EVENT: {};
    OK_EVENT: {};
  }
}

const FailureModel = new MongoDBModel<{ text: string }>({
  name: "failure",
  version: "1",
  transform: mapEvents({
    FAILURE_EVENT(_event) {
      throw new Error("failure");
    },
    OK_EVENT(_event) {
      return {
        insertOne: {
          text: "hello",
        },
      };
    },
  }),
});

describe("e2e_handle_errors", () => {
  it("should pinpoint the offending event", async () => {
    const server = createServer();
    const port = server.port;

    const dbName = "handle_errors_pin_point";

    // clean up the database
    const client = await MongoClient.connect("mongodb://127.1:27017");
    const db = client.db(dbName);
    await db.dropDatabase();
    await client.close();

    const ctrl = new AbortController();

    const appStore = await makeMongoDBStore({
      name: "mongodb-app-1",
      url: `mongodb://127.1:27017/`,
      dbName,
      models: [FailureModel],
    });

    const workerStore = await makeMongoDBStore({
      name: "mongodb-worker-1",
      url: `mongodb://127.1:27017/`,
      dbName,
      models: [FailureModel],
    });

    function onError(err: Error, event: JourneyCommittedEvent) {
      expect(err.message).toEqual("failure");
      expect(event.type).toEqual("FAILURE_EVENT");
      expect(event.id).toEqual(8);
    }

    const app = await initJourney([appStore], port);
    const worker = await initJourney([workerStore], port, onError);

    const OK_EVENT = {
      type: "OK_EVENT",
      payload: {},
    } as const;

    const FAILURE_EVENT = {
      type: "FAILURE_EVENT",
      payload: {},
    } as const;

    await app.journey.append(OK_EVENT); // 1
    await app.journey.append(OK_EVENT); // 2
    await app.journey.append(OK_EVENT); // 3
    await app.journey.append(OK_EVENT); // 4
    await app.journey.append(OK_EVENT); // 5
    await app.journey.append(OK_EVENT); // 6
    await app.journey.append(OK_EVENT); // 7
    await app.journey.append(FAILURE_EVENT);
    await app.journey.append(OK_EVENT);
    await app.journey.append(OK_EVENT);

    // close app because we only want to test the worker
    await app.journey.dispose();

    // start worker and wait for it to stop
    // worker should stop because of the error not the signal, we intentionally avoid sending signal
    await startWorker(worker.journey, ctrl.signal);
    await worker.journey.dispose();
  });
});
