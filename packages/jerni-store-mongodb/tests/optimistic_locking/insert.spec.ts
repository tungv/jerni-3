import makeMongoDBStore from "../../src/store";
import type MongoDBModel from "../../src/model";
import type { JourneyCommittedEvent } from "../../src/types";
import { describe, expect, test } from "bun:test";

describe("Optimistic Locking - Insert", () => {
  test("it should not apply an insertOne twice", async () => {
    interface TestCollection {
      id: number;
      name: string;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_2",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        return [
          {
            insertOne: { id: event.id, name: `test_${event.type}` },
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "optimistic_locking",
      dbName: "mongodb_store_driver_v4_optimistic",
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    await store.handleEvents([
      {
        id: 1,
        type: "event_1",
        payload: {},
      },
      {
        id: 2,
        type: "event_2",
        payload: {},
      },
      {
        id: 2,
        type: "event_2",
        payload: {},
      },
      {
        id: 2,
        type: "event_2",
        payload: {},
      },
      {
        id: 3,
        type: "event_3",
        payload: {},
      },
    ]);

    const collection = store.getDriver(model);
    const result = await collection.find().toArray();

    expect(result.length).toBe(3);
  });

  test("it should not apply an insertMany twice", async () => {
    interface TestCollection {
      id: number;
      name: string;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_3",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        return [
          {
            insertMany: [
              { id: event.id, name: `test_${event.type}_first_pass` },
              { id: event.id, name: `test_${event.type}_second_pass` },
            ],
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "optimistic_locking",
      dbName: "mongodb_store_driver_v4_optimistic",
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    await store.handleEvents([
      {
        id: 1,
        type: "event_1",
        payload: {},
      },
      {
        id: 2,
        type: "event_2",
        payload: {},
      },
      {
        id: 2,
        type: "event_2",
        payload: {},
      },
      {
        id: 1,
        type: "event_1",
        payload: {},
      },
      {
        id: 3,
        type: "event_3",
        payload: {},
      },
    ]);

    const collection = store.getDriver(model);
    const result = await collection.find().toArray();

    expect(result.length).toBe(6);
  });
});
