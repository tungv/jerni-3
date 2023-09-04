import { makeMongoDBStore } from "@jerni/store-mongodb";
import { describe, it, expect } from "bun:test";
import createServer from "src/events-server";
import { LocalEvents } from "jerni/type";
import BankAccountModel from "./fixtures/BankAccountModel";
import BankAccountModel_2 from "./fixtures/BankAccountModel_2";
import { MongoClient } from "mongodb";
import initJourney from "./makeTestJourney";
import startWorker from "./startWorker";

describe("e2e_multiple_stores", () => {
  it("should support multiple stores", async () => {
    const server = createServer();
    const port = server.port;

    console.log("events server port", port);

    const dbName = "test-multiple-stores";

    // clean up the database
    const client = await MongoClient.connect("mongodb://127.1:27017");
    const db = client.db(dbName);
    await db.dropDatabase();
    await client.close();

    const ctrl = new AbortController();

    const storeMongoDbForAppArray = [
      await makeMongoDBStore({
        name: "mongodb-app-1",
        url: `mongodb://127.1:27017/`,
        dbName,
        models: [BankAccountModel],
      }),
      await makeMongoDBStore({
        name: "mongodb-app-2",
        url: `mongodb://127.1:27017/`,
        dbName,
        models: [BankAccountModel_2],
      }),
    ];
    const storeMongoDbForWorkerArray = [
      await makeMongoDBStore({
        name: "mongodb-app-1",
        url: `mongodb://127.1:27017/`,
        dbName,
        models: [BankAccountModel],
      }),
      await makeMongoDBStore({
        name: "mongodb-app-2",
        url: `mongodb://127.1:27017/`,
        dbName,
        models: [BankAccountModel_2],
      }),
    ];

    const app = await initJourney(dbName, storeMongoDbForAppArray, port);
    const worker = await initJourney(dbName, storeMongoDbForWorkerArray, port);

    // start worker
    startWorker(worker.journey, ctrl.signal);

    // commit event
    const event1 = await app.journey.commit<
      LocalEvents["NEW_ACCOUNT_REGISTERED"]
    >({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    const event2 = await app.journey.commit<LocalEvents["ACCOUNT_DEPOSITED"]>({
      type: "ACCOUNT_DEPOSITED",
      payload: {
        id: "123",
        amount: 100,
      },
    });

    await app.journey.waitFor(event2);

    // read from v1
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

    // read from v2
    const BankAccounts_2 = await app.journey.getReader(BankAccountModel_2);
    const bankAccount_2 = await BankAccounts_2.findOne({
      id: "123",
    });

    expect(bankAccount_2.balance).toEqual(100);

    ctrl.abort();

    await app.journey.dispose();
    await worker.journey.dispose();

    console.log("APP LOGS");
    app.logger.logs.forEach((log) => {
      console.log("app >>", ...log);
    });

    console.log("----------");
    console.log("WORKER LOGS");
    worker.logger.logs.forEach((log) => {
      console.log("worker >>", ...log);
    });
  });
});
