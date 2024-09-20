import sqlite from "bun:sqlite";
import type { ToBeCommittedJourneyEvent } from "../types/events";
import appendEventsToMarkdown from "./appendEventsToMarkdown";

export default function commitEvent(sqliteFilePath: string, textFilePath: string, events: ToBeCommittedJourneyEvent[]) {
  const lastId = writeEventToSqlite(sqliteFilePath, events);

  // append events to text file in the background
  appendEventsToMarkdown(textFilePath, events);

  return lastId;
}

function writeEventToSqlite(filePath: string, events: ToBeCommittedJourneyEvent[]) {
  const db = sqlite.open(filePath);

  try {
    const query = db.prepare("INSERT INTO events (type, payload, meta) VALUES ($type, $payload, $meta)");

    for (const event of events) {
      query.run({
        $type: event.type,
        $payload: JSON.stringify(event.payload),
        $meta: JSON.stringify(event.meta ?? {}),
      });
    }

    const last = db.prepare("SELECT id FROM events ORDER BY id DESC LIMIT 1").get() as { id: number };

    return last.id;
  } finally {
    db.close();
  }
}
