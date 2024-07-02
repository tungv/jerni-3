import Database from "bun:sqlite";
import { MongoClient } from "mongodb";

const sqliteDb = new Database("mydb.sqlite");

export default async function cleanUpTestDatabase() {
  // clean up the MongoDB
  const client = await MongoClient.connect("mongodb://127.0.0.1:27017");

  const databases = await client.db().admin().listDatabases();

  const testDbNames = databases.databases.filter((db) => db.name.startsWith("jerni_integration_test_"));

  for (const { name } of testDbNames) {
    await client.db(name).dropDatabase();
  }
  await client.close();

  // clean up the sqlite if there are tables
  sqliteDb.query("DROP TABLE IF EXISTS snapshot").run();
  sqliteDb.query("DROP TABLE IF EXISTS events").run();
}
