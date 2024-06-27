import { describe, expect, test } from "bun:test";
import { getEventDatabase, injectEventDatabase } from "src/events-storage/injectDatabase";
import createServer from "./helpers/events-server";
import { initJourney } from "./helpers/initJourney";
import type { Store } from "src/types/config";

import "src/events-storage/__mocks__/sqlite-database";

function getMockStore(config: Partial<Store>) {
  return {
    meta: {
      includes: [],
    },
    registerModels: () => {},
    handleEvents: () => {},
    ...config,
  } as unknown as Store;
}

describe("New events added to subscription list", () => {
  test(
    "if new events are added to the subscription list, the worker should subscribe from the beginning and persist the new events",
    injectEventDatabase(async () => {
      // SETUP: a server with 2 events
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
          type: "ACCOUNT_UPDATED",
          payload: {
            id: "123",
            name: "test-updated",
          },
        },
      ]);
      const eventServerUrl = `http://localhost:${server.port}`;

      // SETUP: worker subscribes to only 1 event type, and persists the event
      const ctrl = new AbortController();

      const worker1 = await initJourney(eventServerUrl, [
        getMockStore({
          meta: {
            includes: ["ACCOUNT_UPDATED"],
          },
        }),
      ]);

      // stop after the first event is processed and yielded
      for await (const _events of worker1.journey.begin(ctrl.signal)) {
        ctrl.abort();
      }

      // only 1 event is persisted
      const eventDatabase = getEventDatabase();
      const persistedEvents = await eventDatabase.getEventsFrom(0);
      expect(persistedEvents).toEqual([
        {
          id: 2,
          type: "ACCOUNT_UPDATED",
          payload: {
            id: "123",
            name: "test-updated",
          },
        },
      ]);

      // TEST: worker subscribes to 2 event types, the earlier event should also be included in the persisted events
      const worker2 = await initJourney(eventServerUrl, [
        getMockStore({
          meta: {
            includes: ["NEW_ACCOUNT_REGISTERED", "ACCOUNT_UPDATED"],
          },
        }),
      ]);

      const ctrl2 = new AbortController();

      for await (const _events of worker2.journey.begin(ctrl2.signal)) {
        ctrl2.abort();
      }

      // expect both the event types to be added in the includes list
      const lastCall =
        inputSpies.subscriptionInputSpy.mock.calls[inputSpies.subscriptionInputSpy.mock.calls.length - 1];
      const searchParams = lastCall[0];
      const expectedParams = new URLSearchParams({
        includes: "NEW_ACCOUNT_REGISTERED,ACCOUNT_UPDATED",
      });

      expect(expectedParams.toString()).toEqual(searchParams);

      // expect subscribe from the beginning when there is a new event in the includes list
      const req = lastCall[1];
      const lastEventId = req.headers.get("Last-Event-ID");

      expect(lastEventId).toEqual("0");

      // expect the new event to be persisted
      const persistedEvents2 = await eventDatabase.getEventsFrom(0);
      expect(persistedEvents2).toEqual([
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
          type: "ACCOUNT_UPDATED",
          payload: {
            id: "123",
            name: "test-updated",
          },
        },
      ]);
    }),
  );
});
