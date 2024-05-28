import { expect, test } from "bun:test";
import { makeMongoDBStore } from "@jerni/store-mongodb";
import { MongoClient } from "mongodb";
import { createServer, initJourney, startWorker } from "integration-test-jerni";
import { BankAccountModel } from "integration-test-jerni/models";
import { injectEventDatabase } from "src/events-storage/injectDatabase";
import { setTimeout } from "node:timers/promises";

import "src/events-storage/__mocks__/sqlite-database";

test(
  "start subscription from last saved event id",
  injectEventDatabase(async () => {
    const { server, inputSpies } = createServer();
    const port = server.port;

    const dbName = "testsss";

    // clean up the database
    const client = await MongoClient.connect("mongodb://127.1:27017");
    const db = client.db(dbName);
    await db.dropDatabase();
    await client.close();

    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();

    const storeMongoDbForWorker = await makeMongoDBStore({
      name: "mongodb-app",
      url: "mongodb://127.1:27017/",
      dbName,
      models: [BankAccountModel],
    });

    const worker = await initJourney([storeMongoDbForWorker], port);

    // commit event, this should be trigger from app, but for testing purpose, we trigger it from worker
    const event1 = await worker.journey.commit<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    // STEP 1: listen to the first event then terminate the worker
    // start worker
    startWorker(worker.journey, ctrl1.signal);

    await worker.journey.waitFor(event1);

    ctrl1.abort();

    // STEP 2: start worker again, expect the worker subscribe with last-event-id = 1
    startWorker(worker.journey, ctrl2.signal);

    // wait for the worker to start and subscribe
    await setTimeout(300);

    ctrl2.abort();

    const lastCall = inputSpies.subscriptionInputSpy.mock.calls[inputSpies.subscriptionInputSpy.mock.calls.length - 1];
    expect(lastCall[1].headers.get("last-event-id")).toBe("1");
  }),
);
