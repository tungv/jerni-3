import { afterAll } from "bun:test";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";
import { injectEventDatabase } from "../injectDatabase";

afterAll(async () => {
  const client = await MongoClient.connect("mongodb://127.0.0.1:27017");

  const databases = await client.db().admin().listDatabases();

  const testDbNames = databases.databases.filter((db) => db.name.startsWith("jerni_events_test_"));

  for (const { name } of testDbNames) {
    await client.db(name).dropDatabase();
  }
  await client.close();
});

// biome-ignore lint/suspicious/noExplicitAny: any is used to mock any function
type AnyFunction = (...args: any[]) => any;

export default function injectTestEventsMongoDB(computation: AnyFunction) {
  return async () => {
    const mongodbName = `jerni_events_test_${nanoid()}`;

    process.env.EVENTS_DB_MONGODB_URL = "mongodb://localhost:27017";
    process.env.EVENTS_DB_MONGODB_NAME = mongodbName;

    await injectEventDatabase(computation)();

    // remove env so that other tests won't use this
    process.env.EVENTS_DB_MONGODB_URL = undefined;
    process.env.EVENTS_DB_MONGODB_NAME = undefined;
  };
}
