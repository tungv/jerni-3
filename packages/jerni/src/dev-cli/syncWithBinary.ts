import sqlite from "bun:sqlite";
import ensureFileExists from "./ensureFileExists";
import readFile from "./readFile";
import rewriteChecksum from "./rewriteChecksum";

export function syncWithBinary(textFilePath: string, sqliteFilePath: string) {
  ensureFileExists(textFilePath);
  ensureFileExists(sqliteFilePath);

  rewriteChecksum(textFilePath);

  const { events } = readFile(textFilePath);

  // delete all events in sqlite
  // and write all events from text file to sqlite
  const db = sqlite.open(sqliteFilePath);

  db.exec("DELETE FROM events");

  const query = db.prepare("INSERT INTO events ( type, payload, meta) VALUES (?, ?, ?)");

  for (const event of events) {
    query.run(event.type, JSON.stringify(event.payload), JSON.stringify(event.meta));
  }
}
