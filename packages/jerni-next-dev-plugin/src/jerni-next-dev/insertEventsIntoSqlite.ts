import Database from "better-sqlite3";

export default function insertEventsIntoSqlite(events: any[], sqliteFilePath: string) {
  const db = new Database(sqliteFilePath);
  let insertedCount = 0;

  try {
    const stmt = db.prepare("INSERT INTO events (payload, meta, type) VALUES (?, ?, ?)");

    for (const event of events) {
      stmt.run(JSON.stringify(event.payload), JSON.stringify(event.meta || {}), event.type);
      insertedCount++;
    }

    return insertedCount;
  } catch (error) {
    console.error(`Error in insertEvents: ${error.message}`);
    throw error;
  } finally {
    db.close();
  }
}
