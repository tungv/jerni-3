import readPipeline from "../../src/read";
import makeMongoDBStore from "../../src/store";
import type MongoDBModel from "../../src/model";
import type { JourneyCommittedEvent } from "../../src/types";
import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";

interface TestCollection {
  id: number;
  name: string;
}

describe("Read Pipeline Same Collection", () => {
  test("it should allow reading data from the same collection", async () => {
    let assertionCount = 0;
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

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
          const res = readPipeline([{ $match: { id: 2 } }, { $project: { name: 1 } }]);

          assertionCount++;
          expect(res[0].name).toBe("test-model-1--item-2");
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
          const res = readPipeline([{ $match: { id: 2 } }, { $project: { name: 1 } }]);

          assertionCount++;
          expect(res[0].name).toBe("test-model-2--item-2");
          return [];
        }
      },
    };

    const store = await makeMongoDBStore({
      name: "test_read_pipeline",
      dbName,
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

    expect(assertionCount).toBe(2);
  });

  test("it should clear cache when finishing an event", async () => {
    let assertionCount = 0;
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

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
          const res = readPipeline([{ $match: { id: 2 } }, { $project: { name: 1 } }]);

          assertionCount++;
          expect(res[0].name).toBe("test-model-1--item-2");
          return [];
        }

        if (event.type === "test_2") {
          const res = readPipeline([{ $match: { id: 3 } }, { $project: { name: 1 } }]);

          assertionCount++;
          expect(res[0].name).toBe("test-model-1--item-3");
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
          const res = readPipeline([{ $match: { id: 2 } }, { $project: { name: 1 } }]);

          assertionCount++;
          expect(res[0].name).toBe("test-model-2--item-2");
          return [];
        }
      },
    };

    const store = await makeMongoDBStore({
      name: "test_read_pipeline",
      dbName,
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

    expect(assertionCount).toBe(3);
  });

  test("it should allow reading in loop", async () => {
    let assertionCount = 0;
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

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
            const res = readPipeline([{ $match: { id: i + 1 } }, { $project: { name: 1 } }]);

            assertionCount++;
            expect(res[0].name).toBe(`test-model-1--item-${i + 1}`);
          }

          return [];
        }
      },
    };

    const store = await makeMongoDBStore({
      name: "test_read_pipeline",
      dbName,
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

    expect(assertionCount).toBe(3 * 2);
  });
});
