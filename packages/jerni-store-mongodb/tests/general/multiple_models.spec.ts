import { describe, expect, test } from "bun:test";
import { MongoDBModel } from "../../src";
import makeMongoDBStore from "../../src/store";
import type { JourneyCommittedEvent } from "../../src/types";

describe("Multiple models", () => {
  test("it should insert data to all models", async () => {
    const model1 = new MongoDBModel({
      name: "model_1",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.id % 2 === 0) return;
        return [
          {
            insertOne: {
              id: event.id,
            },
          },
        ];
      },
    });

    const model2 = new MongoDBModel({
      name: "model_2",
      version: "1",
      transform(event: JourneyCommittedEvent) {
        if (event.id % 2 === 1) return;
        return [
          {
            insertOne: {
              id: event.id,
            },
          },
        ];
      },
    });

    const store = await makeMongoDBStore({
      name: "test_register_models",
      dbName: "mongodb_multiple_models_test",
      url: "mongodb://127.0.0.1:27017",
      models: [model1, model2],
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
        id: 3,
        type: "event_1",
        payload: {},
      },
    ]);

    await using reader1 = await store.getDriver(model1);
    await using reader2 = await store.getDriver(model2);

    const docs1 = await reader1.find({}).toArray();
    const docs2 = await reader2.find({}).toArray();

    expect(docs1.length).toBe(2);
    expect(docs2.length).toBe(1);

    await store.dispose();
  });
});
