import test from "ava";
import MongoDBModel from "../../src/model";
import makeMongoDBStore from "../../src/store";
import { JourneyCommittedEvent } from "../../src/types";

test("it should not apply an deleteOnce twice", async (t) => {
  interface TestCollection {
    id: number;
    name: string;
  }

  const model: MongoDBModel<TestCollection> = {
    name: "model_delete_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "created") {
        return [
          {
            insertMany: [
              { id: 1, name: "test_1" },
              { id: 2, name: "test_2" },
              { id: 3, name: "test_3" },
              { id: 4, name: "test_4" },
            ],
          },
        ];
      }

      if (event.type === "reinserted") {
        return [
          {
            insertOne: {
              id: 3,
              name: "test_3",
            },
          },
        ];
      }

      return [
        {
          deleteOne: {
            where: {
              id: (event.payload as { deleting_id: number }).deleting_id,
            },
          },
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
      type: "created",
      payload: {},
    },
    {
      id: 2,
      type: "deleted",
      payload: { deleting_id: 3 },
    },
    {
      id: 3,
      type: "reinserted",
      payload: {},
    },
    {
      id: 2,
      type: "deleted",
      payload: { deleting_id: 3 },
    },
  ]);

  const collection = store.getDriver(model);
  const result = await collection.find().sort({ id: "desc" }).toArray();
  t.is(result.length, 4);
  t.deepEqual(
    result.map((x) => x.name),
    ["test_4", "test_3", "test_2", "test_1"],
  );
});

test("it should not apply an deleteMany twice", async (t) => {
  interface TestCollection {
    id: number;
    name: string;
  }

  const model: MongoDBModel<TestCollection> = {
    name: "model_delete_2",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "created") {
        return [
          {
            insertMany: [
              { id: 1, name: "test_1" },
              { id: 2, name: "test_2" },
              { id: 3, name: "test_3" },
              { id: 4, name: "test_4" },
            ],
          },
        ];
      }

      if (event.type === "reinserted") {
        return [
          {
            insertOne: {
              id: 3,
              name: "test_3",
            },
          },
        ];
      }

      return [
        {
          deleteMany: {
            where: {
              id: { $in: [2, 3] },
            },
          },
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
      type: "created",
      payload: {},
    },
    {
      id: 2,
      type: "deleted",
      payload: {},
    },
    {
      id: 3,
      type: "reinserted",
      payload: {},
    },
    {
      id: 2,
      type: "deleted",
      payload: {},
    },
  ]);

  const collection = store.getDriver(model);
  const result = await collection.find().sort({ id: "desc" }).toArray();
  t.is(result.length, 3);
  t.deepEqual(
    result.map((x) => x.name),
    ["test_4", "test_3", "test_1"],
  );
});
