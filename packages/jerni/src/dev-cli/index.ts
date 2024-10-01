#!/usr/bin/env bun

import fs from "node:fs";

import { debounce } from "lodash";
import { INF } from "../cli-utils/log-headers";
import guardErrors from "../guardErrors";
import initEventsServerDev from "./initEventsServerDev";
import initJerniDev from "./initJerniDev";
import readEventsFromMarkDown from "./readEventsFromMarkDown";
import syncReadableEventsToBinaryFile from "./syncReadableEventsToBinaryFile";

console.log("%s jerni dev is starting...", INF);

// TODO: use `minimist` or `sade` here to handle arguments better
const [_bun, _script, initFileName, textDbFile, sqliteDbFile] = process.argv;

await guardErrors(
  async () => {
    // TODO: move reading port to args instead of env, or just randomize it
    const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5001;

    const textFilePath = textDbFile ? textDbFile : "./events.yaml";
    const sqliteFilePath = sqliteDbFile ? sqliteDbFile : "./events.sqlite";

    process.env.EVENTS_SERVER = `http://localhost:${port}`;

    const { start: startJourney, stop: stopJourney } = await initJerniDev(initFileName);

    const { start: startEventsServer, stop: stopEventsServer } = await initEventsServerDev(
      textFilePath,
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
      // if abort error, ignore
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.log("%s unhandledRejection", INF);
      console.log(error);

      stopJourney();
      stopEventsServer();
      process.exit(1);
    });

    startJourney();

    startEventsServer();

    // listen for file changes and restart journey
    fs.watch(
      textFilePath,
      debounce(async () => {
        const { fileChecksum, realChecksum } = await readEventsFromMarkDown(textFilePath);

        if (fileChecksum === realChecksum) {
          return;
        }

        console.log("%s checksum mismatch, clean starting jerni dev…", INF);
        await stopJourney();

        await syncReadableEventsToBinaryFile(textFilePath, sqliteFilePath);

        startJourney({
          cleanStart: true,
        });
      }, 300),
    );

    // listen for stdin
    process.stdin.on("data", async (data) => {
      const input = data.toString().trim();

      if (input === "r") {
        console.log("%s forced restart command received, clean starting jerni dev...", INF);

        await stopJourney();

        await syncReadableEventsToBinaryFile(textFilePath, sqliteFilePath);

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
