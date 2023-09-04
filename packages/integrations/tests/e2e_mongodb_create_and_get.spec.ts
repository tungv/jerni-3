import { makeMongoDBStore } from "@jerni/store-mongodb";
import createJourney from "jerni";
import { describe, it, expect } from "bun:test";
import createServer from "src/events-server";
import { JourneyInstance, LocalEvents } from "jerni/type";
import BankAccountModel from "./fixtures/BankAccountModel";
import { MongoClient } from "mongodb";

describe("e2e_mongodb_create_and_get", () => {
  function makeTestLogger() {
    const logs: string[][] = [];
    return {
      debug: (...msg: any[]) => {
        // logs.push(msg);
      },
      log: (...msg: any[]) => {
        // logs.push(msg);
      },
      warn: (...msg: any[]) => {
        // logs.push(msg);
      },
      info: (...msg: any[]) => {
        logs.push(msg);
      },
      error: (...msg: any[]) => {
        logs.push(msg);
      },
      logs,
    };
  }

  async function initJourney(dbName: string, serverPort: number) {
    const mongodbStore = await makeMongoDBStore({
      url: `mongodb://127.0.0.1:27017/`,
      dbName,
      name: "test",

      models: [BankAccountModel],
    });

    const logger = makeTestLogger();

    const journey = createJourney({
      server: `http://localhost:${serverPort}`,
      // server,
      stores: [mongodbStore],
      onError: (error) => {
        logger.error(error);
      },
      onReport: (reportType, reportData) => {
        console.info(
          "REPORT :: [%s] | %s",
          reportType,
          JSON.stringify(reportData),
        );
      },
      logger,
    });

    return {
      journey,
      logger,
    };
  }

  it("should pass", async () => {
    const server = createServer();
    const port = server.port;

    console.log("events server port", port);

    const dbName = "testsss";

    // clean up the database
    const client = await MongoClient.connect("mongodb://127.1:27017");
    const db = client.db(dbName);
    await db.dropDatabase();

    const ctrl = new AbortController();

    const app = await initJourney(dbName, port);
    const worker = await initJourney(dbName, port);

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

    expect(event1).toEqual({
      id: 1,
      meta: {
        client: "integration-test-jerni",
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

async function startWorker(journey: JourneyInstance, signal: AbortSignal) {
  for await (const events of journey.begin(signal)) {
    console.log("events", events);
  }
}
