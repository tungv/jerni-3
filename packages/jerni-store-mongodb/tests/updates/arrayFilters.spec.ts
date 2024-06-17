import makeMongoDBStore from "../../src/store";
import type MongoDBModel from "../../src/model";
import type { JourneyCommittedEvent } from "../../src/types";
import { describe, expect, test } from "bun:test";
import { nanoid } from "nanoid";

describe("Update Many using Array Filters", () => {
  test("it should apply arrayFilters option", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

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
      dbName,
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
    expect(result.length).toBe(3);
    expect(result.map((student) => student.grades)).toEqual([
      [95, 100, 100],
      [98, 100, 100],
      [95, 92, 90],
    ]);
  });
});
