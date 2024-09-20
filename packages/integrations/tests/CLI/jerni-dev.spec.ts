import sqlite from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import hash_sum from "hash-sum";
import JSON5 from "json5";
import type { Code, Yaml } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown, frontmatterToMarkdown } from "mdast-util-frontmatter";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
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
    const dbFileName = `./test-events-db-${nanoid()}.md`;
    const mongodbName = `jerni_integration_test_${nanoid()}`;
    const sqliteFileName = `./test-events-db-${nanoid()}.sqlite`;

    const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
    const initFileName = path.resolve(__dirname, "./makeTestJourneyCli.ts");
    const dbFilePath = path.resolve(__dirname, dbFileName);
    const sqliteFilePath = path.resolve(__dirname, sqliteFileName);

    const childProcess = exec(
      `PORT=${port}\
        MONGODB_DBNAME=${mongodbName}\
        bun run ${devCliPath} ${initFileName} ${dbFilePath} ${sqliteFilePath}`,
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

    const event2 = await journey.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "1234",
        name: "test",
      },
    });

    await setTimeout(1000);

    childProcess.kill();

    await journey.waitFor(event2);

    const bankAccount2 = await BankAccounts.findOne({
      id: "1234",
    });

    expect(bankAccount2).toEqual({
      __op: 0,
      __v: 2,
      _id: expect.anything(),
      id: "1234",
      name: "test",
      balance: 0,
    });

    childProcess.kill();
  });

  test("if checksum does not match, jerni should clean start", async () => {
    // random a port
    const port = Math.floor(Math.random() * 10000) + 10000;
    const dbFileName = `./test-events-db-${nanoid()}.md`;
    const mongodbName = `jerni_integration_test_${nanoid()}`;
    const sqliteFileName = `./test-events-db-${nanoid()}.sqlite`;

    const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
    const initFileName = path.resolve(__dirname, "./makeTestJourneyCli.ts");
    const dbFilePath = path.resolve(__dirname, dbFileName);
    const sqliteFilePath = path.resolve(__dirname, sqliteFileName);

    const childProcess = exec(
      `PORT=${port}\
        MONGODB_DBNAME=${mongodbName}\
        bun run ${devCliPath} ${initFileName} ${dbFilePath} ${sqliteFilePath}`,
      (error, stdout, stderr) => {
        // console.log("stdout: ", stdout);
        // console.error("stderr: ", stderr);
      },
    );

    await setTimeout(1000);

    process.env.EVENTS_SERVER = `http://localhost:${port}`;
    const mongoConfig = {
      url: "mongodb://localhost:27017",
      dbName: mongodbName,
    };
    const journey = await initializeJourney(mongoConfig);

    // commit 2 events
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

    await journey.waitFor(event2);

    // check balance to be 100
    const BankAccounts = await journey.getReader(BankAccountModel_2);

    const bankAccount1 = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount1).toEqual({
      __op: 0,
      __v: 2,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 100,
    });

    // remove the last event from the db file, so the checksum will not match
    const fileContent = fs.readFileSync(dbFilePath, "utf8");

    const ast = fromMarkdown(fileContent, {
      extensions: [frontmatter(["yaml"])],
      mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
    });

    // pop the last Code Node from the ast
    const lastCodeNodeIndex = ast.children.findLastIndex((node) => node.type === "code");
    if (lastCodeNodeIndex === -1) {
      throw new Error("no last code node");
    }
    ast.children.splice(lastCodeNodeIndex, 1);

    const newFileContent = toMarkdown(ast, {
      extensions: [frontmatterToMarkdown(["yaml"])],
    });

    fs.writeFileSync(dbFilePath, newFileContent);

    // wait for the file to be read, and restart jerni dev
    await setTimeout(1000);

    // the data in the db should have balance 0
    const bankAccount2 = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount2).toEqual({
      __op: 0,
      __v: 1,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 0,
    });

    childProcess.kill();
  });

  test("should clean start jerni dev when r\n is entered", async () => {
    // random a port
    const port = Math.floor(Math.random() * 10000) + 10000;
    const dbFileName = `./test-events-db-${nanoid()}.md`;
    const mongodbName = `jerni_integration_test_${nanoid()}`;
    const sqliteFileName = `./test-events-db-${nanoid()}.sqlite`;

    const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
    const initFileName = path.resolve(__dirname, "./makeTestJourneyCli.ts");
    const dbFilePath = path.resolve(__dirname, dbFileName);
    const sqliteFilePath = path.resolve(__dirname, sqliteFileName);

    const childProcess = exec(
      `PORT=${port}\
        MONGODB_DBNAME=${mongodbName}\
        bun run ${devCliPath} ${initFileName} ${dbFilePath} ${sqliteFilePath}`,
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

    // commit 2 events
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

    await journey.waitFor(event2);

    // check balance to be 100
    const BankAccounts = await journey.getReader(BankAccountModel_2);

    const bankAccount1 = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount1).toEqual({
      __op: 0,
      __v: 2,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 100,
    });

    // remove the last event and rewrite to the db file, so that the checksum will match, no new events, so the data should not be clean
    const fileContent = fs.readFileSync(dbFilePath, "utf8");

    const ast = fromMarkdown(fileContent, {
      extensions: [frontmatter(["yaml"])],
      mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
    });

    // pop the last Code Node from the ast
    const lastCodeNodeIndex = ast.children.findLastIndex((node) => node.type === "code");
    if (lastCodeNodeIndex === -1) {
      throw new Error("no last code node");
    }
    ast.children.splice(lastCodeNodeIndex, 1);

    const eventNodes = ast.children.filter((node): node is Code => node.type === "code");

    const events = eventNodes.map((node, idx) => {
      console.log("node.value: ", node.value);

      return {
        ...JSON5.parse(node.value),
        id: idx + 1,
      };
    });

    const checksumNode = ast.children.find((node): node is Yaml => node.type === "yaml");
    if (!checksumNode) {
      throw new Error("no checksum");
    }

    const newChecksum = hash_sum(events);
    checksumNode.value = yaml.stringify({ checksum: newChecksum });

    const newFileContent = toMarkdown(ast, {
      extensions: [frontmatterToMarkdown(["yaml"])],
    });

    fs.writeFileSync(dbFilePath, newFileContent);

    // wait for the file to be read, and restart jerni dev
    await setTimeout(1000);

    // the data in the db should have balance 0
    const bankAccount2 = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount2).toEqual({
      __op: 0,
      __v: 2,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 100,
    });

    // write r and press enter to child process
    if (!childProcess.stdin) {
      throw new Error("child process has no stdin");
    }
    childProcess.stdin.write("r\n");

    await setTimeout(1000);

    // the data in the db should have balance 0
    const bankAccount3 = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount3).toEqual({
      __op: 0,
      __v: 1,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 0,
    });

    childProcess.kill();
  });

  test("should write the changes to both the binary and the text file", async () => {
    const port = Math.floor(Math.random() * 10000) + 10000;
    const dbFileName = `./test-events-db-${nanoid()}.md`;
    const sqliteFileName = `./test-events-db-${nanoid()}.sqlite`;
    const mongodbName = `jerni_integration_test_${nanoid()}`;

    const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
    const initFileName = path.resolve(__dirname, "./makeTestJourneyCli.ts");
    const dbFilePath = path.resolve(__dirname, dbFileName);
    const sqliteFilePath = path.resolve(__dirname, sqliteFileName);

    const childProcess = exec(
      `PORT=${port}\
        MONGODB_DBNAME=${mongodbName}\
        bun run ${devCliPath} ${initFileName} ${dbFilePath} ${sqliteFilePath}`,
      (error, stdout, stderr) => {
        // console.log(`stdout: ${stdout}`);
        // console.error(`stderr: ${stderr}`);
      },
    );

    // await for the server to start
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

    const fileContent = fs.readFileSync(dbFilePath, "utf8");
    const ast = fromMarkdown(fileContent, {
      extensions: [frontmatter(["yaml"])],
      mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
    });

    const checksumNode = ast.children.find((node): node is Yaml => node.type === "yaml");
    if (!checksumNode) {
      throw new Error("no checksum");
    }

    const checksum = yaml.parse(checksumNode.value).checksum;

    const events = ast.children.filter((node): node is Code => node.type === "code");

    expect(events).toHaveLength(1);
    const event = JSON5.parse(events[0].value);
    expect(event).toEqual({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
      meta: expect.any(Object),
    });

    const calculatedChecksum = hash_sum(
      events.map((event, idx) => ({
        ...JSON5.parse(event.value),
        id: idx + 1,
      })),
    );

    expect(calculatedChecksum).toEqual(checksum);

    const sqliteDb = sqlite.open(sqliteFilePath);
    const rows = sqliteDb.query("SELECT * FROM events").all() as Array<{
      id: number;
      type: string;
      payload: string;
      meta: string;
    }>;

    const parsedRows = rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload),
      meta: JSON.parse(row.meta),
    }));

    expect(parsedRows).toEqual([
      {
        id: 1,
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
        meta: expect.any(Object),
      },
    ]);

    childProcess.kill();
  });
});
