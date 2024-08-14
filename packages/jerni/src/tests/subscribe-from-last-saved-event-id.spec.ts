import { expect, test } from "bun:test";
import { getEventDatabase, injectEventDatabase } from "src/events-storage/injectDatabase";
import begin from "../begin";
import createServer from "./helpers/events-server";
import { initJourney } from "./helpers/initJourney";

import "src/events-storage/__mocks__/sqlite-database";

test(
  "start subscription from last saved event id",
  injectEventDatabase(async () => {
    // Setup: create an events server that has 1 event, then start worker to save the event
    const { server, commitEvent, inputSpies } = createServer([
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

    const ctrl1 = new AbortController();

    const worker1 = await initJourney(eventServerUrl, []);

    // subscribe to events
    for await (const _events of begin(worker1.journey, ctrl1.signal)) {
      ctrl1.abort();
    }

    // commit a new event
    commitEvent({
      id: 2,
      type: "ACCOUNT_DEPOSITED",
      payload: {
        id: "123",
        amount: 100,
      },
    });

    const ctrl2 = new AbortController();

    const worker2 = await initJourney(eventServerUrl, []);

    // subscribe to events
    for await (const output of begin(worker2.journey, ctrl2.signal)) {
      if (output.lastProcessedEventId === 2) {
        ctrl2.abort();
      }
    }

    // check that the last event id is sent in the headers
    const lastCall = inputSpies.subscriptionInputSpy.mock.calls[inputSpies.subscriptionInputSpy.mock.calls.length - 1];
    const req = lastCall[1];

    expect(req.headers.get("Last-Event-Id")).toBe("1");

    // check that the events are persisted in the database
    const eventDatabase = getEventDatabase();
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
