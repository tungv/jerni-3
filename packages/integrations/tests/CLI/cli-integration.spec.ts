import { it, expect, afterAll } from "bun:test";
import createServer from "src/events-server";
import { BankAccountModel, BankAccountModel_2 } from "../models";
import { nanoid } from "nanoid";
import initializeJourney from "./makeTestJourneyCli";
import { exec } from "node:child_process";
import { MongoClient } from "mongodb";
import path from "node:path";

afterAll(async () => {
  const client = await MongoClient.connect("mongodb://127.0.0.1:27017");

  const databases = await client.db().admin().listDatabases();

  const testDbNames = databases.databases.filter((db) => db.name.startsWith("jerni_integration_test_"));

  for (const { name } of testDbNames) {
    await client.db(name).dropDatabase();
  }
});

it("CLI call should project events correctly", async () => {
  const dbName = `jerni_integration_test_${nanoid()}`;

  const { server } = createServer();
  const port = server.port;

  const createJourneyPath = path.resolve(__dirname, "./makeTestJourneyCli.ts");

  exec(
    `MONGODB_DBNAME=${dbName} MONGODB_URL=mongodb://127.0.0.1:27017 EVENTS_SERVER=http://localhost:${port}/ bunx jerni ${createJourneyPath}`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    },
  );

  const journey = await initializeJourney(
    {
      url: "mongodb://127.0.0.1:27017",
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

  await journey.waitFor(event2);

  // read
  const BankAccounts = await journey.getReader(BankAccountModel);
  const BankAccounts_2 = await journey.getReader(BankAccountModel_2);

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
});
