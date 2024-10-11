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

describe("Checking if the store is safe for dev", () => {
  const prefixes = ["dev__", "local__", "test__"];

  test.each(prefixes)('it should return false if store\'s name does not prefix with "%s"', async () => {
    const store = await makeMongoDBStore({
      name: "test",
      dbName: "mongodb_store_driver_v4_test_connection",
      url: "mongodb://127.0.0.1:27017",
      models: [],
    });

    const isSafeForDev = await store.isSafeForDev();
    expect(isSafeForDev).toBeFalse();
  });

  test.each(prefixes)('it should return true if store\'s name is prefixed with "%s"', async (allowedPrefix) => {
    const store = await makeMongoDBStore({
      name: "test",
      dbName: `${allowedPrefix}mongodb_store_driver_v4_test_connection`,
      url: "mongodb://127.0.0.1:27017",
      models: [],
    });

    const isSafeForDev = await store.isSafeForDev();
    expect(isSafeForDev).toBeTrue();
  });
});
