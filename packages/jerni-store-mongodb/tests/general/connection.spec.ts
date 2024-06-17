import { describe, expect, test } from "bun:test";
import makeMongoDBStore from "../../src/store";
import { nanoid } from "nanoid";

describe("create MongoDBStore instance", () => {
  test("it should create a store with a dispose fn", async () => {
    const dbName = `mongodb_store_driver_v4_${nanoid()}`;

    const store = await makeMongoDBStore({
      name: "test",
      dbName,
      url: "mongodb://127.0.0.1:27017",
      models: [],
    });

    expect(store.name).toBe("test");
    expect(store.meta).toEqual({
      includes: [],
    });

    await store.dispose();
  });
});
