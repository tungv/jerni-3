import { describe, expect, test } from "bun:test";
import { getEventDatabase, injectEventDatabase } from "src/events-storage/injectDatabase";
import begin from "../begin";
import createServer from "./helpers/events-server";
import { initJourney } from "./helpers/initJourney";

import "src/events-storage/__mocks__/sqlite-database";

describe("Persist event to file system", () => {
  test(
    "received events should be persist to local database",
    injectEventDatabase(async () => {
      const { server } = createServer([
        {
          id: 1,
          type: "NEW_ACCOUNT_REGISTERED",
          payload: {
            id: "123",
            name: "test",
          },
        },
      ]);
      const eventServerUrl = `http://localhost:${server.port}`;

      const ctrl = new AbortController();

      const worker = await initJourney(eventServerUrl, []);

      // stop after the first event is processed and yielded
      for await (const _events of begin(worker.journey, ctrl.signal)) {
        ctrl.abort();
      }

      const eventDatabase = getEventDatabase();

      const persistedEvents = await eventDatabase.getEventsFrom(0);

      expect(persistedEvents).toEqual([
        {
          id: 1,
          type: "NEW_ACCOUNT_REGISTERED",
          payload: {
            id: "123",
            name: "test",
          },
        },
      ]);
    }),
  );
});
