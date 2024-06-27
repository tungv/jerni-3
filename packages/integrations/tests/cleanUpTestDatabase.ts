import { MongoClient } from "mongodb";
import Database from "bun:sqlite";

const sqliteDb = new Database("mydb.sqlite");

export default async function cleanUpTestDatabase(dbName: string) {
  // clean up the MongoDB
  const client = await MongoClient.connect("mongodb://127.1:27017");
  const db = client.db(dbName);
  await db.dropDatabase();
  await client.close();

  // clean up the sqlite
  sqliteDb.query("DELETE FROM events").run();
  sqliteDb.query("DELETE FROM snapshot").run();
}
