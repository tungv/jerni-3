import Database from "better-sqlite3";

export default function cleanSqliteDatabase(sqliteFilePath: string) {
  const db = new Database(sqliteFilePath);

  try {
    // Drop the events table if it exists
    db.exec("DROP TABLE IF EXISTS events");

    // Recreate the events table
    db.exec(`CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      meta TEXT NOT NULL,
      type TEXT NOT NULL
    )`);
  } catch (error) {
    console.error(`Error cleaning SQLite database: ${(error as Error).message}`);
    throw error;
  } finally {
    db.close();
  }
}
