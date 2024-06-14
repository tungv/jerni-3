import { afterAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";
import type MongoDBModel from "src/model";
import readPipeline from "src/read";
import makeMongoDBStore from "src/store";
import type { JourneyCommittedEvent, MongoOps } from "src/types";

interface TestCollection {
  id: number;
  name: string;
}

afterAll(async () => {
  const client = await MongoClient.connect("mongodb://127.0.0.1:27017");
  client
    .db()
    .admin()
    .listDatabases({ nameOnly: true })
    .then(async (dbs) => {
      for (const db of dbs.databases) {
        if (db.name.startsWith("test_mongodb_store_driver_v4_")) {
          await client.db(db.name).dropDatabase();
        }
      }
    });
});

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

  test("the model slots should be cleared after processing an event", async () => {
    // TODO: have a variable to count the number of assertions then check if the number of assertions is correct
    // this assertions does not work as expected
    expect.assertions(4);

    const model_1: MongoDBModel<TestCollection> = {
      name: "model_read_1",
      version: "1",
      transform(event: JourneyCommittedEvent): MongoOps<TestCollection>[] {
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

        // update the row with id = 1 to have name = "test-model-1--item-1-updated"
        if (event.type === "test1") {
          return [
            {
              updateOne: {
                where: { id: 1 },
                changes: { $set: { name: "test-model-1--item-1-updated" } },
              },
            },
          ];
        }

        return [];
      },
    };

    const model_2: MongoDBModel<TestCollection> = {
      name: "model_read_2",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "init") {
          return [];
        }

        if (event.type === "test1") {
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

        if (event.type === "test2") {
          const result = readPipeline<TestCollection>(model_1, [
            {
              $match: { id: 1 },
            },
            {
              $project: { name: 1, id: 1 },
            },
          ]);

          // if the model slots are not cleared, the result will be "test-model-1--item-1"
          expect(result[0].name).toBe("test-model-1--item-1-updated");
          expect(result[0].id).toBe(1);

          return [];
        }
      },
    };

    const store = await makeMongoDBStore({
      name: "test_read_pipeline",
      dbName: "mongodb_store_driver_v4_test_read_pipeline",
      url: "mongodb://127.0.0.1:27017",
      models: [model_2, model_1],
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
        type: "test1",
        payload: {},
      },
      {
        id: 3,
        type: "test2",
        payload: {},
      },
    ]);
  });

  test("readPipeline cross model can be called in loop", async () => {
    expect.assertions(3 + 2 + 1);

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
            const res = readPipeline(model_2, [{ $match: { id: i + 1 } }, { $project: { name: 1 } }]);

            expect(res[0].name).toBe(`test-model-2--item-${i + 1}`);
          }

          return [];
        }
      },
    };

    const model_2: MongoDBModel<TestCollection> = {
      name: "model_read_loop_2",
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
          for (let i = 0; i < 3; i++) {
            const res = readPipeline(model_1, [{ $match: { id: i + 1 } }, { $project: { name: 1 } }]);

            expect(res[0].name).toBe(`test-model-1--item-${i + 1}`);
          }

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

  test("handle case where the other collection is  more advanced", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    const model_1: MongoDBModel<TestCollection> = {
      name: "model_1",
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
          return [
            {
              updateOne: {
                where: { id: 1 },
                changes: { $set: { name: "test-model-1--item-1-updated" } },
              },
            },
          ];
        }
      },
    };

    const model_2: MongoDBModel<TestCollection> = {
      name: "model_2",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "init") {
          return [
            {
              insertOne: { id: 1, name: "test-model-2--item-1" },
            },
          ];
        }

        if (event.type === "test") {
          const res = readPipeline(model_1, [{ $match: { id: 1 } }, { $project: { name: 1 } }]) as { name: string }[];

          // if reading from the correct version of the model 1, then the name should not be updated yet
          expect(res[0].name).toBe("test-model-1--item-1");

          return [];
        }
      },
      dependencies: [model_1],
    };

    const store1 = await makeMongoDBStore({
      name: "test_read_pipeline",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model_1],
    });

    // make the model 1 more advanced
    await store1.handleEvents([
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

    const store2 = await makeMongoDBStore({
      name: "test_read_pipeline",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model_1, model_2],
    });

    // at the point, the model 1 is more advanced than the model 2
    await store2.handleEvents([
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
