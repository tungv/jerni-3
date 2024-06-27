import { describe, expect, test } from "bun:test";
import type MongoDBModel from "../../src/model";
import makeMongoDBStore from "../../src/store";
import type { JourneyCommittedEvent } from "../../src/types";
import { nanoid } from "nanoid";

describe("handle events for models", () => {
  test("it should fan out all events to all models", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    let assertionCount = 0;

    const model1 = {
      name: "model_1",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        assertionCount++;
        expect(true).toBeTrue();
        return [];
      },
    };

    const model2 = {
      name: "model_2",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        assertionCount++;
        expect(true).toBeTrue();
        return [];
      },
    };

    const store = await makeMongoDBStore({
      name: "test_register_models",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model1, model2],
    });

    const changes = await store.handleEvents([
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
        id: 3,
        type: "event_1",
        payload: {},
      },
    ]);

    const lastSeen = await store.getLastSeenId();

    expect(lastSeen).toBe(3);

    expect(changes).toEqual({
      model_1_v1: {
        added: 0,
        updated: 0,
        deleted: 0,
      },
      model_2_v1: {
        added: 0,
        updated: 0,
        deleted: 0,
      },
    });

    assertionCount += 2;

    await store.dispose();

    // 2 models, each model should receive 3 events, plus the last seen id and the changes assertion = 3 * 2 + 1 + 1 = 8
    expect(assertionCount).toBe(8);
  });

  test("bulkWrite changes to mongodb", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    interface TestCollection {
      id: number;
      name: string;
    }

    const model: MongoDBModel<TestCollection> = {
      name: "model_1",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        return [
          {
            insertOne: { id: event.id, name: `test_${event.type}` },
          },
          {
            updateOne: {
              where: { id: event.id },
              changes: { $set: { name: `test_${event.type}` } },
            },
          },
        ];
      },
    };

    const store = await makeMongoDBStore({
      name: "test_bulk_write",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [model],
    });

    await store.clean();

    const changes = await store.handleEvents([
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
    ]);

    const collection = store.getDriver(model);

    expect(collection.collectionName).toBe("model_1_v1");

    expect(changes).toEqual({
      model_1_v1: {
        added: 2,
        updated: 2,
        deleted: 0,
      },
    });

    expect(await collection.countDocuments()).toBe(2);
  });
});
