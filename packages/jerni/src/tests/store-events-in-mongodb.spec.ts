import { describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import begin from "../begin";
import createServer from "./helpers/events-server";
import { initJourney } from "./helpers/initJourney";

describe("Persist event to file system", () => {
  test("received events should be persist to mongodb database", async () => {
    process.env.EVENTS_DB_MONGODB_URL = "mongodb://localhost:27017";
    process.env.EVENTS_DB_MONGODB_NAME = "jerni_events_test";

    const { server } = createServer([
      {
        id: 1,
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
      },
    ]);
    const eventServerUrl = `http://localhost:${server.port}`;

    const ctrl = new AbortController();

    const worker = await initJourney(eventServerUrl, []);

    // stop after the first event is processed and yielded
    for await (const _events of begin(worker.journey, ctrl.signal)) {
      ctrl.abort();
    }

    const client = await MongoClient.connect("mongodb://127.0.0.1:27017");
    const db = client.db("jerni_events_test");
    const persistedEvents = await db.collection("events").find().toArray();

    expect(persistedEvents).toEqual([
      {
        _id: expect.anything(),
        id: 1,
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
      },
    ]);

    await client.db("jerni_events_test").dropDatabase();

    await client.close();
    process.env.EVENTS_DB_MONGODB_NAME = undefined;
    process.env.EVENTS_DB_MONGODB_URL = undefined;
  });
});
