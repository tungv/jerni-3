import test from "ava";
import readPipeline from "../../src/read";
import makeMongoDBStore from "../../src/store";
import MongoDBModel from "../../src/model";
import { JourneyCommittedEvent } from "../../src/types";

interface TestCollection {
  id: number;
  name: string;
}

test("it should allow reading data from the same collection", async (t) => {
  t.plan(2);

  const model_1: MongoDBModel<TestCollection> = {
    name: "model_read_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "init") {
        return [
          {
            insertMany: [
              { id: 1, name: "test-model-1--item-1" },
              { id: 2, name: "test-model-1--item-2" },
              { id: 3, name: "test-model-1--item-3" },
            ],
          },
        ];
      }

      if (event.type === "test") {
        const res = readPipeline([
          { $match: { id: 2 } },
          { $project: { name: 1 } },
        ]);

        t.deepEqual(res[0].name, "test-model-1--item-2");
        return [];
      }
    },
  };

  const model_2: MongoDBModel<TestCollection> = {
    name: "model_read_2",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "init") {
        return [
          {
            insertMany: [
              { id: 1, name: "test-model-2--item-1" },
              { id: 2, name: "test-model-2--item-2" },
              { id: 3, name: "test-model-2--item-3" },
            ],
          },
        ];
      }

      if (event.type === "test") {
        const res = readPipeline([
          { $match: { id: 2 } },
          { $project: { name: 1 } },
        ]);

        t.deepEqual(res[0].name, "test-model-2--item-2");
        return [];
      }
    },
  };

  const store = await makeMongoDBStore({
    name: "test_read_pipeline",
    dbName: "mongodb_store_driver_v4_test_read_pipeline",
    url: "mongodb://127.0.0.1:27017",
    models: [model_1, model_2],
  });

  await store.clean();
  await store.handleEvents([
    {
      id: 1,
      type: "init",
      payload: {},
    },
    {
      id: 2,
      type: "test",
      payload: {},
    },
  ]);
});

test("it should clear cache when finishing an event", async (t) => {
  t.plan(3);

  const model_1: MongoDBModel<TestCollection> = {
    name: "model_read_clear_cache_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "init") {
        return [
          {
            insertMany: [
              { id: 1, name: "test-model-1--item-1" },
              { id: 2, name: "test-model-1--item-2" },
              { id: 3, name: "test-model-1--item-3" },
            ],
          },
        ];
      }

      if (event.type === "test_1") {
        const res = readPipeline([
          { $match: { id: 2 } },
          { $project: { name: 1 } },
        ]);

        t.deepEqual(res[0].name, "test-model-1--item-2");
        return [];
      }

      if (event.type === "test_2") {
        const res = readPipeline([
          { $match: { id: 3 } },
          { $project: { name: 1 } },
        ]);

        t.deepEqual(res[0].name, "test-model-1--item-3");
        return [];
      }
    },
  };

  const model_2: MongoDBModel<TestCollection> = {
    name: "model_read_clear_cache_2",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "init") {
        return [
          {
            insertMany: [
              { id: 1, name: "test-model-2--item-1" },
              { id: 2, name: "test-model-2--item-2" },
              { id: 3, name: "test-model-2--item-3" },
            ],
          },
        ];
      }

      if (event.type === "test_1") {
        const res = readPipeline([
          { $match: { id: 2 } },
          { $project: { name: 1 } },
        ]);

        t.deepEqual(res[0].name, "test-model-2--item-2");
        return [];
      }
    },
  };

  const store = await makeMongoDBStore({
    name: "test_read_pipeline",
    dbName: "mongodb_store_driver_v4_test_read_pipeline",
    url: "mongodb://127.0.0.1:27017",
    models: [model_1, model_2],
  });

  await store.clean();
  await store.handleEvents([
    {
      id: 1,
      type: "init",
      payload: {},
    },
    {
      id: 2,
      type: "test_1",
      payload: {},
    },
    {
      id: 3,
      type: "test_2",
      payload: {},
    },
  ]);
});

test("it should allow reading in loop", async (t) => {
  t.plan(3 + 2 + 1);

  const model_1: MongoDBModel<TestCollection> = {
    name: "model_read_loop_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "init") {
        return [
          {
            insertMany: [
              { id: 1, name: "test-model-1--item-1" },
              { id: 2, name: "test-model-1--item-2" },
              { id: 3, name: "test-model-1--item-3" },
            ],
          },
        ];
      }

      if (event.type === "test") {
        for (let i = 0; i < 3; i++) {
          const res = readPipeline([
            { $match: { id: i + 1 } },
            { $project: { name: 1 } },
          ]);
          t.deepEqual(res[0].name, "test-model-1--item-" + (i + 1));
        }

        return [];
      }
    },
  };

  const store = await makeMongoDBStore({
    name: "test_read_pipeline",
    dbName: "mongodb_store_driver_v4_test_read_pipeline",
    url: "mongodb://127.0.0.1:27017",
    models: [model_1],
  });

  await store.clean();
  await store.handleEvents([
    {
      id: 1,
      type: "init",
      payload: {},
    },
    {
      id: 2,
      type: "test",
      payload: {},
    },
  ]);
});
