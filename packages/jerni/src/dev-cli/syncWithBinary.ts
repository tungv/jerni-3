import sqlite from "bun:sqlite";
import ensureFileExists from "./ensureFileExists";
import readFile from "./readFile";
import rewriteChecksum from "./rewriteChecksum";

/**
 * TODO: change function name
 * This function changes the content of the binary file.
 */
export default function syncWithBinary(textFilePath: string, sqliteFilePath: string) {
  ensureFileExists(textFilePath);
  ensureFileExists(sqliteFilePath);

  rewriteChecksum(textFilePath);

  const { events } = readFile(textFilePath);

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
