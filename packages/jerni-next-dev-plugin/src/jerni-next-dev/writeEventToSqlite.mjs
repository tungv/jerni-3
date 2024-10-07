import Database from "better-sqlite3";

export default function writeEventToSqlite(filePath, events) {
  const db = new Database(filePath);

  const insertStmt = db.prepare("INSERT INTO events (type, payload, meta) VALUES (?, ?, ?)");

  db.transaction(() => {
    for (const event of events) {
      insertStmt.run(event.type, JSON.stringify(event.payload), JSON.stringify(event.meta ?? {}));
    }
  })();

  const lastId = db.prepare("SELECT id FROM events ORDER BY id DESC LIMIT 1").get().id;

  db.close();

  return lastId;
}
