import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

export default async function cleanUpTestDatabase() {
  // clean up the MongoDB
  const client = await MongoClient.connect("mongodb://127.0.0.1:27017");

  const databases = await client.db().admin().listDatabases();

  const testDbNames = databases.databases.filter((db) => db.name.startsWith("jerni_integration_test_"));

  for (const { name } of testDbNames) {
    await client.db(name).dropDatabase();
  }
  await client.close();

  // clean up the event db files from jerni dev
  const testDir = path.resolve(__dirname, "./CLI");
  const files = fs.readdirSync(testDir);

  const dbFiles = files.filter((file) => file.startsWith("test-events-db-"));

  // remove all the files
  for (const file of dbFiles) {
    fs.unlinkSync(path.resolve(testDir, file));
  }
}
