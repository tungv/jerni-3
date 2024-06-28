import { describe, expect, it } from "bun:test";
import { MongoDBModel, makeMongoDBStore } from "@jerni/store-mongodb";
import type { JourneyCommittedEvent } from "@jerni/store-mongodb/lib/src/types";
import JerniPersistenceError from "jerni/lib/errors/JerniPersistenceError";
import mapEvents from "jerni/lib/mapEvents";
import createServer from "src/events-server";
import cleanUpTestDatabase from "../cleanUpTestDatabase";
import initJourney from "../makeTestJourney";
import startWorker from "../startWorker";

declare module "jerni/type" {
  interface LocalEvents {
    FAILURE_EVENT: { [k: string]: never };
  }
}

const FailureModel = new MongoDBModel({
  name: "failure",
  version: "1",
  transform: mapEvents({
    FAILURE_EVENT(_event) {
      throw new Error("failure");
    },
  }),
});

describe("e2e_handle_errors", () => {
  it("should report error", async () => {
    const { server } = createServer();
    const port = server.port;

    const dbName = "handle_errors";

    // clean up the database
    await cleanUpTestDatabase(dbName);

    const ctrl = new AbortController();

    const store = await makeMongoDBStore({
      name: "mongodb-app-1",
      url: "mongodb://127.1:27017/",
      dbName,
      models: [FailureModel],
    });

    function onError(err: Error, event: JourneyCommittedEvent) {
      expect(err.message).toEqual("failure");
      expect(event.type).toEqual("FAILURE_EVENT");
      expect(event.id).toEqual(1);
    }

    const app = await initJourney([store], port);
    const worker = await initJourney([store], port, onError);

    // start worker
    const stopped = startWorker(worker.journey, ctrl.signal);

    // commit event
    const event1 = await app.journey.append({
      type: "FAILURE_EVENT",
      payload: {},
    });

    await stopped;

    try {
      // this should never be reached
      await app.journey.waitFor(event1, 100);
    } catch (ex) {
      expect(ex instanceof JerniPersistenceError).toEqual(true);
    }

    ctrl.abort();

    await app.journey.dispose();
    await worker.journey.dispose();
  });
});
