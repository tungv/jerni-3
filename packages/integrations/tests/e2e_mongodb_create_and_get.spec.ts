import { makeMongoDBStore } from "@jerni/store-mongodb";
import { describe, it, expect } from "bun:test";
import createServer from "src/events-server";
import BankAccountModel from "./fixtures/BankAccountModel";
import initJourney from "./makeTestJourney";
import startWorker from "./startWorker";
import cleanUpTestDatabase from "./cleanUpTestDatabase";

describe("e2e_mongodb_create_and_get", () => {
  it("should pass", async () => {
    const { server } = createServer();
    const port = server.port;

    const dbName = "testsss";

    // clean up the database
    await cleanUpTestDatabase(dbName);

    const ctrl = new AbortController();

    const storeMongoDbForApp = await makeMongoDBStore({
      name: "mongodb-app",
      url: "mongodb://127.1:27017/",
      dbName,
      models: [BankAccountModel],
    });

    const storeMongoDbForWorker = await makeMongoDBStore({
      name: "mongodb-worker",
      url: "mongodb://127.1:27017/",
      dbName,
      models: [BankAccountModel],
    });

    const app = await initJourney([storeMongoDbForApp], port);
    const worker = await initJourney([storeMongoDbForWorker], port);

    // start worker
    startWorker(worker.journey, ctrl.signal);

    // commit event
    const event1 = await app.journey.commit<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    expect(event1).toEqual({
      id: 1,
      meta: {
        client: "jerni",
        client_version: "3.0.0",
        committed_at: expect.any(Number),
        local_id: expect.any(String),
        server_url: `http://localhost:${port}/`,
      },
      payload: {
        id: "123",
        name: "test",
      },
      type: "NEW_ACCOUNT_REGISTERED",
    });

    await app.journey.waitFor(event1);

    // check report
    // because bun doesn't support toHaveBeenCalledWith, we need to check the mock calls
    const reports = worker.onReport.mock.calls;
    const outputReport = reports.find(([type]) => {
      return type === "store_output";
    });

    expect(outputReport).toEqual([
      "store_output",
      {
        output: {
          bank_accounts_v1: {
            added: 1,
            updated: 0,
            deleted: 0,
          },
        },
        store: storeMongoDbForWorker,
      },
    ]);

    // read
    const BankAccounts = await app.journey.getReader(BankAccountModel);

    const bankAccount = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount).toEqual({
      __op: 0,
      __v: 1,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 0,
    });

    ctrl.abort();

    await app.journey.dispose();
    await worker.journey.dispose();
  });
});
