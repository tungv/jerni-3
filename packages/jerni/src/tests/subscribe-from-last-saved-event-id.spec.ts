import { expect, test } from "bun:test";
import { getEventDatabase, injectEventDatabase } from "src/events-storage/injectDatabase";
import begin from "../begin";
import createServer from "./helpers/events-server";
import { initJourney } from "./helpers/initJourney";

import "src/events-storage/__mocks__/sqlite-database";

declare module "@jerni/jerni-3/types" {
  export interface SubscribingEventDefinitions {
    NEW_ACCOUNT_REGISTERED: {
      id: string;
      name: string;
    };
    ACCOUNT_DEPOSITED: {
      id: string;
      amount: number;
    };
  }
}

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

    let processedId = 0;
    const worker2 = await initJourney(eventServerUrl, [
      {
        name: "test",
        clean: async () => {},
        dispose: async () => {},
        getDriver: async () => {
          return {
            [Symbol.asyncDispose]: async () => {},
          };
        },
        async *listen() {},
        meta: {
          includes: [],
        },
        registerModels: () => {},
        getLastSeenId: async () => 1,

        async handleEvents(events) {
          console.log("events", events);
          const lastEvent = events.at(-1);
          if (lastEvent) {
            processedId = lastEvent.id;
          }

          return [];
        },
      },
    ]);

    console.log(worker2.logger.logs);

    // subscribe to events
    for await (const output of begin(worker2.journey, ctrl2.signal)) {
      if (processedId === 2) {
        ctrl2.abort();
      }
    }

    // check that the last event id is sent in the headers
    const lastCall = inputSpies.subscriptionInputSpy.mock.calls.at(-1);
    expect(lastCall).not.toBeUndefined();

    // biome-ignore lint/style/noNonNullAssertion: expect(lastCall).not.toBeUndefined();
    const req = lastCall![1];

    expect(req.headers.get("Last-Event-Id")).toBe("1");
  }),
);
