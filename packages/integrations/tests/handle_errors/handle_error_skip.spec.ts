import { MongoDBModel, makeMongoDBStore } from "@jerni/store-mongodb";
import { describe, it, expect } from "bun:test";
import createServer from "src/events-server";
import initJourney from "../makeTestJourney";
import startWorker from "../startWorker";
import mapEvents from "jerni/lib/mapEvents";
import SKIP from "jerni/lib/skip";
import cleanUpTestDatabase from "../cleanUpTestDatabase";

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
  it("should continue to process if SKIP is returned", async () => {
    const server = createServer();
    const port = server.port;

    const dbName = "handle_errors_with_skip";

    // clean up the database
    await cleanUpTestDatabase(dbName);

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

    function onError() {
      return SKIP;
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
    const lastEvent = await app.journey.append(OK_EVENT);

    // start worker
    const stopped = startWorker(worker.journey, ctrl.signal);

    await app.journey.waitFor(lastEvent);

    const Collection = await app.journey.getReader(FailureModel);
    const count = await Collection.countDocuments();
    expect(count).toEqual(9);

    ctrl.abort();

    await stopped;

    await app.journey.dispose();
    await worker.journey.dispose();
  });
});
