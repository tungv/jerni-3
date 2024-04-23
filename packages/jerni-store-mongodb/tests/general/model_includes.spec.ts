import test from "ava";
import makeMongoDBStore from "../../src/store";
import { JourneyCommittedEvent } from "../../src/types";

test("it should register included event types from all models if they all specify their interested events", async (t) => {
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

  t.deepEqual(store.meta.includes, ["event_1", "event_2", "event_3"]);

  await store.dispose();
});

test("it should register all events if at least one model does not specify its interested events", async (t) => {
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

  t.deepEqual(store.meta.includes, []);

  await store.dispose();
});
