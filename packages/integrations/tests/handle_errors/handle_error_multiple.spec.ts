import { afterAll, describe, expect, it } from "bun:test";
import { MongoDBModel, makeMongoDBStore } from "@jerni/store-mongodb";
import type { JourneyCommittedEvent } from "@jerni/store-mongodb/types";
import dispose from "jerni/lib/dispose";
import mapEvents from "jerni/lib/mapEvents";
import SKIP from "jerni/lib/skip";
import { nanoid } from "nanoid";
import createServer from "src/events-server";
import cleanUpTestDatabase from "../cleanUpTestDatabase";
import initJourney from "../makeTestJourney";
import startWorker from "../startWorker";

declare module "@jerni/jerni-3/types" {
  interface CommittingEventDefinitions {
    FAILURE_EVENT: { [k: string]: never };
    OK_EVENT: { [k: string]: never };
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

afterAll(cleanUpTestDatabase);

describe("e2e_handle_errors_multiple", () => {
  it("should continue to process if SKIP is returned", async () => {
    const { server } = createServer();
    const port = server.port;

    const dbName = `jerni_integration_test_${nanoid()}`;

    const ctrl = new AbortController();

    const appStore = await makeMongoDBStore({
      name: "mongodb-app-1",
      url: "mongodb://127.1:27017/",
      dbName,
      models: [FailureModel],
    });

    const workerStore = await makeMongoDBStore({
      name: "mongodb-worker-1",
      url: "mongodb://127.1:27017/",
      dbName,
      models: [FailureModel],
    });

    function onError(_error: Error, event: JourneyCommittedEvent) {
      // only skip the 3rd event
      if (event.id === 3) {
        return SKIP;
      }

      // the 6th event will stop the worker
      if (event.id === 6) {
        return;
      }

      // and the 10th event won't be processed
      if (event.id === 10) {
        expect(false);
      }
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

    // 1 - 3
    await app.journey.append(OK_EVENT);
    await app.journey.append(OK_EVENT);
    await app.journey.append(FAILURE_EVENT);

    // 4 - 6
    await app.journey.append(OK_EVENT);
    const event5 = await app.journey.append(OK_EVENT);
    await app.journey.append(FAILURE_EVENT);

    // 7 - 9
    await app.journey.append(OK_EVENT);
    await app.journey.append(OK_EVENT);
    await app.journey.append(OK_EVENT);

    // 10 - 12
    await app.journey.append(FAILURE_EVENT);
    await app.journey.append(OK_EVENT);
    await app.journey.append(OK_EVENT);

    const lastEvent = await app.journey.append(OK_EVENT);

    // start worker
    const stopped = startWorker(worker.journey, ctrl.signal);

    // await for worker to stop due to the 6th event
    await stopped;

    const Collection = await app.journey.getReader(FailureModel);
    const count = await Collection.countDocuments();
    expect(count).toEqual(4);

    await dispose(app.journey);
    await dispose(worker.journey);
  });
});
