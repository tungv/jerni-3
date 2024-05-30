import { describe, expect, test } from "bun:test";
import type { JourneyCommittedEvent } from "jerni/type";
import type MongoDBModel from "src/model";
import readPipeline from "src/read";
import makeMongoDBStore from "src/store";

interface TestCollection {
  id: number;
  name: string;
}

describe("Read Pipeline Different Collection", () => {
  test("it should allow reading data from different collection", async () => {
    expect.assertions(2);

    const model_1: MongoDBModel<TestCollection> = {
      name: "model_read_1",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "init") {
          return [
            {
              insertOne: { id: 1, name: "test-model-1--item-1" },
            },
          ];
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
          const result = readPipeline<TestCollection>(model_1, [
            {
              $match: { id: 1 },
            },
            {
              $project: { name: 1, id: 1 },
            },
          ]);

          expect(result[0].name).toBe("test-model-1--item-1");
          expect(result[0].id).toBe(1);

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
});
