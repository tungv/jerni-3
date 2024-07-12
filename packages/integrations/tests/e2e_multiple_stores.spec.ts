import { afterAll, describe, expect, it } from "bun:test";
import dispose from "@jerni/jerni-3/lib/dispose";
import { makeMongoDBStore } from "@jerni/store-mongodb";
import { nanoid } from "nanoid";
import createServer from "src/events-server";
import cleanUpTestDatabase from "./cleanUpTestDatabase";
import BankAccountModel from "./fixtures/BankAccountModel";
import BankAccountModel_2 from "./fixtures/BankAccountModel_2";
import initJourney from "./makeTestJourney";
import startWorker from "./startWorker";

afterAll(cleanUpTestDatabase);

describe("e2e_multiple_stores", () => {
  it("should support multiple stores", async () => {
    const { server } = createServer();
    const port = server.port;

    const dbName = `jerni_integration_test_${nanoid()}`;

    const ctrl = new AbortController();

    const storeMongoDbForAppArray = [
      await makeMongoDBStore({
        name: "mongodb-app-1",
        url: "mongodb://127.1:27017/",
        dbName,
        models: [BankAccountModel],
      }),
      await makeMongoDBStore({
        name: "mongodb-app-2",
        url: "mongodb://127.1:27017/",
        dbName,
        models: [BankAccountModel_2],
      }),
    ];
    const storeMongoDbForWorkerArray = [
      await makeMongoDBStore({
        name: "mongodb-app-1",
        url: "mongodb://127.1:27017/",
        dbName,
        models: [BankAccountModel],
      }),
      await makeMongoDBStore({
        name: "mongodb-app-2",
        url: "mongodb://127.1:27017/",
        dbName,
        models: [BankAccountModel_2],
      }),
    ];

    const app = await initJourney(storeMongoDbForAppArray, port);
    const worker = await initJourney(storeMongoDbForWorkerArray, port);

    // start worker
    startWorker(worker.journey, ctrl.signal);

    // commit event
    await app.journey.append({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    const event2 = await app.journey.append({
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

    await dispose(app.journey);
    await dispose(worker.journey);
  });
});
