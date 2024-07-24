import { afterEach, describe, expect, test } from "bun:test";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { nanoid } from "nanoid";
import yaml from "yaml";
import cleanUpTestDatabase from "../cleanUpTestDatabase";
import { BankAccountModel, BankAccountModel_2 } from "../models";
import initializeJourney from "./makeTestJourneyCli";

afterEach(cleanUpTestDatabase);

describe("Jerni Dev Integration", () => {
  test("a newly committed event should be persisted", async () => {
    // random a port
    const port = Math.floor(Math.random() * 10000) + 10000;
    const dbFileName = `./test-events-db-${nanoid()}.yml`;
    const mongodbName = `jerni_integration_test_${nanoid()}`;

    const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
    const initFileName = path.resolve(__dirname, "./makeTestJourneyCli.ts");
    const dbFilePath = path.resolve(__dirname, dbFileName);

    const childProcess = exec(
      `PORT=${port}\
        MONGODB_DBNAME=${mongodbName}\
        bun run ${devCliPath} ${initFileName} ${dbFilePath}`,
      (error, stdout, stderr) => {
        // console.log(`stdout: ${stdout}`);
        // console.error(`stderr: ${stderr}`);
      },
    );

    await setTimeout(1000);

    process.env.EVENTS_SERVER = `http://localhost:${port}`;
    const mongoConfig = {
      url: "mongodb://localhost:27017",
      dbName: mongodbName,
    };
    const journey = await initializeJourney(mongoConfig);

    // commit event
    const event1 = await journey.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    await journey.waitFor(event1);

    const BankAccounts = await journey.getReader(BankAccountModel);

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

    childProcess.kill();
  });
});
