import { describe, expect, test } from "bun:test";
import makeMongoDBStore from "../../src/store";
import type { JourneyCommittedEvent } from "../../src/types";

describe("Register events", () => {
  test("it should register included event types from all models if they all specify their interested events", async () => {
    const model1 = {
      name: "model_1",
      version: "1",
      transform(_event: JourneyCommittedEvent) {
        return [];
      },
      meta: {
        includes: ["event_3", "event_2"],
      },
    };

    const model2 = {
      name: "model_2",
      version: "1",
      transform(_event: JourneyCommittedEvent) {
        return [];
      },
      meta: {
        includes: ["event_1", "event_2"],
      },
    };

    const store = await makeMongoDBStore({
      name: "test_register_models",
      dbName: "mongodb_store_driver_v4_test_register_models",
      url: "mongodb://127.0.0.1:27017",
      models: [model1, model2],
    });

    const map = new Map();
    store.registerModels(map);

    expect(store.meta.includes).toEqual(["event_1", "event_2", "event_3"]);

    await store.dispose();
  });

  test("it should register all events if at least one model does not specify its interested events", async () => {
    const model1 = {
      name: "model_1",
      version: "1",
      transform(_event: JourneyCommittedEvent) {
        return [];
      },
      meta: {
        includes: ["event_3", "event_2"],
      },
    };

    const model2 = {
      name: "model_2",
      version: "1",
      transform(_event: JourneyCommittedEvent) {
        return [];
      },
    };

    const store = await makeMongoDBStore({
      name: "test_register_models",
      dbName: "mongodb_store_driver_v4_test_register_models",
      url: "mongodb://127.0.0.1:27017",
      models: [model1, model2],
    });

    const map = new Map();
    store.registerModels(map);

    // empty array means all events
    expect(store.meta.includes).toEqual([]);

    await store.dispose();
  });
});
