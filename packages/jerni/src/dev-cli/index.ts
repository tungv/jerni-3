#!/usr/bin/env bun

import fs from "node:fs";

import { debounce } from "lodash";
import { INF } from "../cli-utils/log-headers";
import guardErrors from "../guardErrors";
import initEventsServerDev from "./initEventsServerDev";
import initJerniDev from "./initJerniDev";
import readFile from "./readFile";
import { syncWithBinary } from "./syncWithBinary";

console.log("%s jerni dev is starting...", INF);

const [_bun, _script, initFileName, textDbFile, sqliteDbFile] = process.argv;

await guardErrors(
  async () => {
    const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5000;

    const dbFilePath = textDbFile ? textDbFile : "./events.yaml";
    const sqliteFilePath = sqliteDbFile ? sqliteDbFile : "./events.sqlite";

    process.env.EVENTS_SERVER = `http://localhost:${port}`;

    const { start: startJourney, stop: stopJourney } = await initJerniDev(initFileName);

    const { start: startEventsServer, stop: stopEventsServer } = await initEventsServerDev(
      dbFilePath,
      sqliteFilePath,
      port,
    );

    // call server.stop when process is killed
    process.on("SIGINT", () => {
      stopJourney();
      stopEventsServer();
      process.exit(0);
    });

    // onError, stop journey and server
    process.on("unhandledRejection", (error) => {
      console.error("%s unhandledRejection", INF);
      console.error(error);

      stopJourney();
      stopEventsServer();
    });

    startJourney();

    startEventsServer();

    // listen for file changes and restart journey
    fs.watch(
      dbFilePath,
      debounce(async () => {
        console.log("%s file changed, restarting jerni dev...", INF);

        await stopJourney();

        const { fileChecksum, realChecksum } = readFile(dbFilePath);

        if (fileChecksum !== realChecksum) {
          console.log("%s checksum mismatch, clean starting jerni dev…", INF);

          syncWithBinary(dbFilePath, sqliteFilePath);

          startJourney({
            cleanStart: true,
          });

          return;
        }

        startJourney();
      }, 300),
    );

    // listen for stdin
    process.stdin.on("data", async (data) => {
      const input = data.toString().trim();

      if (input === "r") {
        console.log("%s forced restart command received, clean starting jerni dev...", INF);

        await stopJourney();

        syncWithBinary(dbFilePath, sqliteFilePath);

        startJourney({
          cleanStart: true,
        });

        return;
      }

      console.log("%s unknown command: %s", INF, input);
    });
  },
  () => {
    console.error("%s jerni client is shutting down…", INF);
    process.exit(1);
  },
);
