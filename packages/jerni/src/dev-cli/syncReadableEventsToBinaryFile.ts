import sqlite from "bun:sqlite";
import readEventsFromMarkDown from "./readEventsFromMarkDown";
import rewriteChecksum from "./rewriteChecksum";

export default async function syncReadableEventsToBinaryFile(textFilePath: string, sqliteFilePath: string) {
  await rewriteChecksum(textFilePath);

  const { events } = await readEventsFromMarkDown(textFilePath);

  // delete all events in sqlite
  // and write all events from text file to sqlite
  const db = sqlite.open(sqliteFilePath);

  // delete all rows of table events
  db.prepare("DELETE FROM events").run();

  const query = db.prepare("INSERT INTO events (type, payload, meta) VALUES (?, ?, ?)");

  for (const event of events) {
    query.run(event.type, JSON.stringify(event.payload), JSON.stringify(event.meta ?? {}));
  }
}
