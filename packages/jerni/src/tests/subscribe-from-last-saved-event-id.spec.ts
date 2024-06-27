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

    const { server, commit, inputSpies } = createServer([
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

    // subscribe to events
    for await (const _events of worker.journey.begin(ctrl.signal)) {
      ctrl.abort();
    }

    const firstTimeEvents = await eventDatabase.getEventsFrom(0);
    expect(firstTimeEvents.length).toBe(1);
    // End of setup

    const newEvent = {
      id: 2,
      type: "ACCOUNT_DEPOSITED",
      payload: {
        id: "123",
        amount: 100,
      },
    };

    commit(newEvent);

    const ctrl2 = new AbortController();

    const worker2 = await initJourney(eventServerUrl, []);

    for await (const _events of worker2.journey.begin(ctrl2.signal)) {
      ctrl2.abort();
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
