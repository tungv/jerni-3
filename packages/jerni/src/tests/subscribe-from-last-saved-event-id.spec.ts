import { expect, test } from "bun:test";
import { getEventDatabase, injectEventDatabase } from "src/events-storage/injectDatabase";
import createServer from "./helpers/events-server";
import { initJourney } from "./helpers/initJourney";

import "src/events-storage/__mocks__/sqlite-database";

test(
  "start subscription from last saved event id",
  injectEventDatabase(async () => {
    // Setup: there is an event already saved in the database
    const eventDatabase = getEventDatabase();
    eventDatabase.insertEvents([
      {
        id: 1,
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
      },
    ]);

    // Setup: create an events server that has 2 events
    const { server, inputSpies } = createServer([
      {
        id: 1,
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
      },
      {
        id: 2,
        type: "ACCOUNT_DEPOSITED",
        payload: {
          id: "123",
          amount: 100,
        },
      },
    ]);

    const eventServerUrl = `http://localhost:${server.port}`;

    const ctrl = new AbortController();

    const worker = await initJourney(eventServerUrl, []);

    // subscribe to events
    for await (const _events of worker.journey.begin(ctrl.signal)) {
      ctrl.abort();
    }

    // check that the last event id is sent in the headers
    const lastCall = inputSpies.subscriptionInputSpy.mock.calls[inputSpies.subscriptionInputSpy.mock.calls.length - 1];
    expect(lastCall[1].headers.get("last-event-id")).toBe("1");

    // check that the events are persisted in the database
    const events = await eventDatabase.getEventsFrom(0);
    expect(events).toEqual([
      {
        id: 1,
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
      },
      {
        id: 2,
        type: "ACCOUNT_DEPOSITED",
        payload: {
          id: "123",
          amount: 100,
        },
      },
    ]);
  }),
);
