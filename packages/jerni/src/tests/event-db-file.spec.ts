import { afterAll, describe, expect, test } from "bun:test";
import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { nanoid } from "nanoid";
import yaml from "yaml";
import injectTestEventsMongoDB from "../events-storage/__mocks__/mongodb-database";
import initializeJourney from "./helpers/makeTestJourneyCli";

afterAll(() => {
  // get all the files with prefix test-events-db-
  const files = fs.readdirSync(__dirname);
  const dbFiles = files.filter((file) => file.startsWith("test-events-db-"));

  // remove all the files
  for (const file of dbFiles) {
    fs.unlinkSync(path.resolve(__dirname, file));
  }
});

describe("Manipulating event db file", () => {
  test("a new file will be created if it does not exist", async () => {
    // random a port
    const port = Math.floor(Math.random() * 10000) + 10000;
    const dbFileName = `./test-events-db-${nanoid()}.yml`;

    const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
    const initFileName = path.resolve(__dirname, "./helpers/makeTestJourneyCli.ts");
    const dbFilePath = path.resolve(__dirname, dbFileName);

    const process = exec(
      `PORT=${port}\
      bun run ${devCliPath} ${initFileName} ${dbFilePath}`,
      (error, stdout, stderr) => {
        // console.log(`stdout: ${stdout}`);
        // console.error(`stderr: ${stderr}`);
      },
    );

    let fileCreated = false;
    for (let tryCount = 0; tryCount < 5; tryCount++) {
      if (fs.existsSync(dbFilePath)) {
        fileCreated = true;
        break;
      }

      await setTimeout(100);
    }

    expect(fileCreated).toBe(true);

    const fileContent = fs.readFileSync(dbFilePath, "utf8");
    const parsedContent = yaml.parse(fileContent);

    expect(parsedContent).toEqual({ checksum: "", events: [] });

    process.kill();
  });

  test(
    "commit events successfully",
    injectTestEventsMongoDB(async () => {
      // random a port
      const port = Math.floor(Math.random() * 10000) + 10000;
      const dbFileName = `./test-events-db-${nanoid()}.yml`;

      const devCliPath = path.resolve(__dirname, "../../../jerni/src/dev-cli/index.ts");
      const initFileName = path.resolve(__dirname, "./helpers/makeTestJourneyCli.ts");
      const dbFilePath = path.resolve(__dirname, dbFileName);

      const process = exec(
        `PORT=${port}\
        bun run ${devCliPath} ${initFileName} ${dbFilePath}`,
        (error, stdout, stderr) => {
          // console.log(`stdout: ${stdout}`);
          // console.error(`stderr: ${stderr}`);
        },
      );

      await setTimeout(1000);

      const journey = await initializeJourney(`http://localhost:${port}/`);

      // commit event
      const event1 = await journey.append<"NEW_ACCOUNT_REGISTERED">({
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
      });

      const fileContent = fs.readFileSync(dbFilePath, "utf8");
      const parsedContent = yaml.parse(fileContent);

      expect(parsedContent.events).toEqual([event1]);

      process.kill();
    }),
  );
});
