import test from "ava";
import makeMongoDBStore from "../../src/store";
import MongoDBModel from "../../src/model";
import { JourneyCommittedEvent } from "../../src/types";

test("it should apply arrayFilters option", async (t) => {
  interface TestCollection {
    id: number;
    grades: number[];
  }

  const model: MongoDBModel<TestCollection> = {
    name: "update_array_filters_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.type === "init") {
        return [
          {
            insertMany: [
              { id: 1, grades: [95, 92, 90] },
              { id: 2, grades: [98, 100, 102] },
              { id: 3, grades: [95, 110, 100] },
            ],
          },
        ];
      }

      if (event.type === "reset") {
        return [
          {
            updateMany: {
              where: {},
              changes: {
                $set: { "grades.$[element]": 100 },
              },
              arrayFilters: [{ element: { $gte: 100 } }],
            },
          },
        ];
      }
    },
  };

  const store = await makeMongoDBStore({
    name: "update_array_filters",
    dbName: "mongodb_store_driver_v4_updates",
    url: "mongodb://127.0.0.1:27017",
    models: [model],
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
      type: "reset",
      payload: { updating_id: 2 },
    },
  ]);

  const collection = store.getDriver(model);
  const result = await collection.find().sort({ id: "desc" }).toArray();
  t.is(result.length, 3);
  t.deepEqual(
    result.map((student) => student.grades),
    [
      [95, 100, 100],
      [98, 100, 100],
      [95, 92, 90],
    ],
  );
});
