import sqlite from "bun:sqlite";
import type { JourneyCommittedEvent } from "../types/events";
import appendEventsToFile from "./appendEventsToFile";

export default function commitEvent(sqliteFilePath: string, textFilePath: string, events: JourneyCommittedEvent[]) {
  writeEventToSqlite(sqliteFilePath, events);
  const lastId = appendEventsToFile(textFilePath, events);

  return lastId;
}

function writeEventToSqlite(filePath: string, events: JourneyCommittedEvent[]) {
  const db = sqlite.open(filePath);

  try {
    const query = db.prepare("INSERT INTO events (type, payload, meta) VALUES ($type, $payload, $meta)");

    for (const event of events) {
      query.run({
        $type: event.type,
        $payload: JSON.stringify(event.payload),
        $meta: JSON.stringify(event.meta),
      });
    }
  } finally {
    db.close();
  }
}
