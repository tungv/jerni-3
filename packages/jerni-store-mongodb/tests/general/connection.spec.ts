import { describe, expect, test } from "bun:test";
import makeMongoDBStore from "../../src/store";

describe("create MongoDBStore instance", () => {
  test("it should create a store with a dispose fn", async () => {
    const store = await makeMongoDBStore({
      name: "test",
      dbName: "mongodb_store_driver_v4_test_connection",
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
