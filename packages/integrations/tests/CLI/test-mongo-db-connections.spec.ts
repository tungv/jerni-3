import { afterAll, expect, test } from "bun:test";
import { exec } from "node:child_process";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";
import createServer from "src/events-server";
import cleanUpTestDatabase from "../cleanUpTestDatabase";
import { BankAccountModel, BankAccountModel_2 } from "../models";
import initializeJourney from "./makeTestJourneyCli";

afterAll(cleanUpTestDatabase);

test("CLI call should project events correctly", async () => {
  const dbName = `jerni_integration_test_${nanoid()}`;

  const { server } = createServer();
  const port = server.port;
  const healthCheckPort = Math.floor(Math.random() * 10000) + 10000;

  const createJourneyPath = path.resolve(__dirname, "./makeTestJourneyCli.ts");
  const jerniCliPath = path.resolve(__dirname, "../../../jerni/src/cli.ts");

  const process = exec(
    `MONGODB_DBNAME=${dbName} \
    MONGODB_URL=mongodb://127.0.0.1:27017 \
    EVENTS_SERVER=http://localhost:${port}/ \
    PORT=${healthCheckPort} \
    bun run ${jerniCliPath} \
    ${createJourneyPath}`,
    (error, stdout, stderr) => {
      // console.log(`stdout: ${stdout}`);
      // console.error(`stderr: ${stderr}`);
    },
  );

  const journey = await initializeJourney(
    {
      url: "mongodb://127.0.0.1:27017?appName=jerni-integration-test",
      dbName,
    },
    `http://localhost:${port}/`,
  );

  // commit event
  const event1 = await journey.append<"NEW_ACCOUNT_REGISTERED">({
    type: "NEW_ACCOUNT_REGISTERED",
    payload: {
      id: "123",
      name: "test",
    },
  });
  const event2 = await journey.append<"ACCOUNT_DEPOSITED">({
    type: "ACCOUNT_DEPOSITED",
    payload: {
      id: "123",
      amount: 100,
    },
  });

  expect(event1).toEqual({
    id: 1,
    meta: {
      client: "mock-client",
      client_version: expect.any(String),
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

  await journey.waitFor(event2);

  // read
  // Wrap in a closure to automatically dispose of the readers
  await (async () => {
    await using BankAccounts = await journey.getReader(BankAccountModel);
    await using BankAccounts_2 = await journey.getReader(BankAccountModel_2);

    const bankAccount = await BankAccounts.findOne({
      id: "123",
    });
    const bankAccount_2 = await BankAccounts_2.findOne({
      id: "123",
    });

    // this model does not process the deposit event
    expect(bankAccount).toEqual({
      __op: 0,
      __v: 1,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 0,
    });

    // this model process the deposit event
    expect(bankAccount_2).toEqual({
      __op: 0,
      __v: 2,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 100,
    });
  })();

  await journey.dispose();

  // the health check server should be running
  const req = await fetch(`http://localhost:${healthCheckPort}`);
  expect(req.status).toBe(200);

  process.kill();

  await setTimeout(1000);

  expect(fetch(`http://localhost:${healthCheckPort}`)).rejects.toHaveProperty(
    "message",
    "Unable to connect. Is the computer able to access the url?",
  );

  // after everything is disposed, the connection should be closed
  const connectionByAppName = await getMongoDbConnection();
  expect(connectionByAppName["jerni-integration-test"] || 0).toEqual(0);
});

async function getMongoDbConnection() {
  const url = "mongodb://127.0.0.1:27017/";
  const client = await MongoClient.connect(url);

  const connections = await client.db().admin().command({
    currentOp: 1,
    $all: true,
  });

  const connectionByAppName = connections.inprog.reduce(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (acc: Record<string, number>, cur: any) => {
      const appName = cur.appName || "Unknown";
      acc[appName] = (acc[appName] || 0) + 1;

      return acc;
    },
    {} as Record<string, number>,
  );

  await client.close();

  return connectionByAppName;
}
