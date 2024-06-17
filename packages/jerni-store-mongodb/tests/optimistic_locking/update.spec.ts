import makeMongoDBStore from "../../src/store";
import type MongoDBModel from "../../src/model";
import type { JourneyCommittedEvent } from "../../src/types";
import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";

describe("Optimistic Locking - Update", () => {
  test("it should not apply an updateOne twice with `changes`", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    interface TestCollection {
      id: number;
      name: string;
      counter: number;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_update_1",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "created") {
          return [
            {
              insertMany: [
                { id: 1, name: "test_1", counter: 0 },
                { id: 2, name: "test_2", counter: 0 },
                { id: 3, name: "test_3", counter: 0 },
                { id: 4, name: "test_4", counter: 0 },
              ],
            },
          ];
        }

        return [
          {
            updateOne: {
              where: {
                id: (event.payload as { updating_id: number }).updating_id,
              },
              changes: {
                $set: { name: "------" }, // idempotent update
                $inc: { counter: 1 }, // non-idempotent update
              },
            },
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "optimistic_locking",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    await store.handleEvents([
      {
        id: 1,
        type: "created",
        payload: {},
      },
      {
        id: 2,
        type: "updated",
        payload: { updating_id: 2 },
      },
      {
        id: 2,
        type: "updated",
        payload: { updating_id: 2 },
      },
      {
        id: 3,
        type: "updated",
        payload: { updating_id: 3 },
      },
    ]);

    const collection = store.getDriver(model);
    const result = await collection.find().sort({ id: "desc" }).toArray();
    expect(result.length).toBe(4);
    expect(result.map((x) => x.name)).toEqual(["test_4", "------", "------", "test_1"]);
    expect(result.map((x) => x.counter)).toEqual([0, 1, 1, 0]);
  });

  test("it should not apply an updateOne twice with `pipeline`", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    interface TestCollection {
      id: number;
      name: string;
      counter: number;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_update_2",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "created") {
          return [
            {
              insertMany: [
                { id: 1, name: "test_1", counter: 0 },
                { id: 2, name: "test_2", counter: 0 },
                { id: 3, name: "test_3", counter: 0 },
                { id: 4, name: "test_4", counter: 0 },
              ],
            },
          ];
        }

        return [
          {
            updateOne: {
              where: {
                id: (event.payload as { updating_id: number }).updating_id,
              },
              pipeline: [
                { $addFields: { name: "------" } }, // idempotent update
                {
                  $addFields: { counter: { $add: ["$counter", 1] } },
                }, // non-idempotent update
              ],
            },
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "optimistic_locking",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    await store.handleEvents([
      {
        id: 1,
        type: "created",
        payload: {},
      },
      {
        id: 2,
        type: "updated",
        payload: { updating_id: 2 },
      },
      {
        id: 2,
        type: "updated",
        payload: { updating_id: 2 },
      },
      {
        id: 3,
        type: "updated",
        payload: { updating_id: 3 },
      },
    ]);

    const collection = store.getDriver(model);
    const result = await collection.find().sort({ id: "desc" }).toArray();
    expect(result.length).toBe(4);
    expect(result.map((x) => x.name)).toEqual(["test_4", "------", "------", "test_1"]);
    expect(result.map((x) => x.counter)).toEqual([0, 1, 1, 0]);
  });

  test("it should not apply an updateMany twice with `changes`", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    interface TestCollection {
      id: number;
      name: string;
      counter: number;
      group: number;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_update_3",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "created") {
          return [
            {
              insertMany: [
                { id: 1, name: "test_1", group: 1, counter: 0 },
                { id: 2, name: "test_2", group: 2, counter: 0 },
                { id: 3, name: "test_3", group: 1, counter: 0 },
                { id: 4, name: "test_4", group: 3, counter: 0 },
                { id: 5, name: "test_5", group: 4, counter: 0 },
                { id: 6, name: "test_6", group: 1, counter: 0 },
              ],
            },
          ];
        }

        return [
          {
            updateMany: {
              where: {
                group: { $gte: 2 },
              },
              changes: {
                $set: { name: "------" }, // idempotent update
                $inc: { counter: 1 }, // non-idempotent update
              },
            },
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "optimistic_locking",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    await store.handleEvents([
      {
        id: 1,
        type: "created",
        payload: {},
      },
      {
        id: 2,
        type: "updated",
        payload: {},
      },
      {
        id: 2,
        type: "updated",
        payload: {},
      },
      {
        id: 3,
        type: "updated",
        payload: {},
      },
    ]);

    const collection = store.getDriver(model);
    const result = await collection.find().sort({ id: "desc" }).toArray();
    expect(result.length).toBe(6);
    expect(result.map((x) => x.name)).toEqual(["test_6", "------", "------", "test_3", "------", "test_1"]);
    expect(result.map((x) => x.counter)).toEqual([0, 2, 2, 0, 2, 0]);
  });

  test("it should not apply an updateMany twice with `pipeline`", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    interface TestCollection {
      id: number;
      name: string;
      counter: number;
      group: number;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_update_4",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.type === "created") {
          return [
            {
              insertMany: [
                { id: 1, name: "test_1", group: 1, counter: 0 },
                { id: 2, name: "test_2", group: 2, counter: 0 },
                { id: 3, name: "test_3", group: 1, counter: 0 },
                { id: 4, name: "test_4", group: 3, counter: 0 },
                { id: 5, name: "test_5", group: 4, counter: 0 },
                { id: 6, name: "test_6", group: 1, counter: 0 },
              ],
            },
          ];
        }

        return [
          {
            updateMany: {
              where: {
                group: { $gte: 2 },
              },
              pipeline: [
                { $addFields: { name: "------" } }, // idempotent update
                {
                  $addFields: { counter: { $add: ["$counter", 1] } },
                }, // non-idempotent update
              ],
            },
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "optimistic_locking",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    await store.handleEvents([
      {
        id: 1,
        type: "created",
        payload: {},
      },
      {
        id: 2,
        type: "updated",
        payload: {},
      },
      {
        id: 2,
        type: "updated",
        payload: {},
      },
      {
        id: 3,
        type: "updated",
        payload: {},
      },
    ]);

    const collection = store.getDriver(model);
    const result = await collection.find().sort({ id: "desc" }).toArray();
    expect(result.length).toBe(6);
    expect(result.map((x) => x.name)).toEqual(["test_6", "------", "------", "test_3", "------", "test_1"]);
    expect(result.map((x) => x.counter)).toEqual([0, 2, 2, 0, 2, 0]);
  });
});
