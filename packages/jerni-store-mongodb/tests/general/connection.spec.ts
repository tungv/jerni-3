import test from "ava";
import makeMongoDBStore from "../../src/store";

test("it should create a store with a dispose fn", async (t) => {
  const store = await makeMongoDBStore({
    name: "test",
    dbName: "mongodb_store_driver_v4_test_connection",
    url: "mongodb://127.0.0.1:27017",
    models: [],
  });

  t.is(store.name, "test");
  t.deepEqual(store.meta, {
    includes: [],
  });

  await store.dispose();
});
