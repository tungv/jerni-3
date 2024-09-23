import sqlite from "bun:sqlite";
import type { ToBeCommittedJourneyEvent } from "../types/events";
import appendEventsToMarkdown from "./appendEventsToMarkdown";
import debounce from "./debounce";

const debouncedFnByTextFilePath = new Map<string, (arg: ToBeCommittedJourneyEvent[]) => void>();

// curry the appendEventsToMarkdown function with the textFilePath
// append events to text file in the background, also debounce to prevent conflicts when multiple events are committed at the same time
function getDebouncedAppendEvents(textFilePath: string) {
  let debouncedFn = debouncedFnByTextFilePath.get(textFilePath);

  if (!debouncedFn) {
    const curried = appendEventsToMarkdown.bind(null, textFilePath);
    debouncedFn = debounce(curried, 300);
    debouncedFnByTextFilePath.set(textFilePath, debouncedFn);
  }

  return debouncedFn;
}

export default function commitEvent(sqliteFilePath: string, textFilePath: string, events: ToBeCommittedJourneyEvent[]) {
  const lastId = writeEventToSqlite(sqliteFilePath, events);

  const debouncedAppendEventsToMarkdown = getDebouncedAppendEvents(textFilePath);

  debouncedAppendEventsToMarkdown(events);

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
