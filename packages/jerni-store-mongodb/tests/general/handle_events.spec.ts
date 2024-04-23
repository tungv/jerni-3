import test from "ava";
import MongoDBModel from "../../src/model";
import makeMongoDBStore from "../../src/store";
import { JourneyCommittedEvent } from "../../src/types";

test("it should fan out all events to all models", async (t) => {
  t.plan(8);
  const model1 = {
    name: "model_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      t.pass();
      return [];
    },
  };

  const model2 = {
    name: "model_2",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      t.pass();
      return [];
    },
  };

  const store = await makeMongoDBStore({
    name: "test_register_models",
    dbName: "mongodb_store_driver_v4_test_register_models",
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

  t.is(lastSeen, 3);

  t.deepEqual(changes, {
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

  await store.dispose();
});

test("bulkWrite changes to mongodb", async (t) => {
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
          insertOne: { id: event.id, name: "test_" + event.type },
        },
        {
          updateOne: {
            where: { id: event.id },
            changes: { $set: { name: "test_" + event.type } },
          },
        },
      ];
    },
  };

  const store = await makeMongoDBStore({
    name: "test_bulk_write",
    dbName: "mongodb_store_driver_v4_test_bulk_write",
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

  t.is(collection.collectionName, "model_1_v1");
  t.deepEqual(changes, {
    model_1_v1: {
      added: 2,
      updated: 2,
      deleted: 0,
    },
  });

  t.is(await collection.countDocuments(), 2);
});
