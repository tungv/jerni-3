#!/usr/bin/env bun

import fs from "node:fs";

import { debounce } from "lodash";
import { INF } from "../cli-utils/log-headers";
import guardErrors from "../guardErrors";
import initiateJerniDev from "./jerniDev";
import readFile from "./readFile";
import startEventsServerDev from "./startEventServerDev";

console.log("%s jerni dev is starting...", INF);

const [_bun, _script, initFileName, dbFileName] = process.argv;

await guardErrors(
  async () => {
    const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5000;

    process.env.EVENTS_SERVER = `http://localhost:${port}`;

    const { start: startJourney, stop: stopJourney } = await initiateJerniDev(initFileName);

    const { start: startEventsServer, stop: stopEventsServer } = await startEventsServerDev(dbFileName, port);

    // call server.stop when process is killed
    process.on("SIGINT", () => {
      stopJourney();
      stopEventsServer();
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
      dbFileName,
      debounce(async () => {
        console.log("%s file changed, restarting jerni dev...", INF);

        await stopEventsServer();
        await stopJourney();

        const { fileChecksum, realChecksum } = readFile(dbFileName);

        if (fileChecksum !== realChecksum) {
          console.log("%s checksum mismatch, clean starting jerni dev...", INF);

          startEventsServer();
          startJourney({
            cleanStart: true,
          });

          return;
        }

        startEventsServer();
        startJourney();
      }, 300),
    );

    // listen for stdin
    process.stdin.on("data", async (data) => {
      const input = data.toString().trim();

      if (input === "r") {
        console.log("%s clean starting jerni dev...", INF);

        await stopEventsServer();
        await stopJourney();

        startEventsServer();
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
