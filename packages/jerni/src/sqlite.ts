import sqlite from "bun:sqlite";
import type { Message } from "./getMessage";
import type { JourneyCommittedEvent } from "./types/events";

export interface EventDatabase {
  getById(id: number): JourneyCommittedEvent;
  getBlock(from: number, to: number): JourneyCommittedEvent[];
  persistBatch(events: Message[]): void;
}

interface SavedEvent {
  id: number;
  message: string;
}

export default function makeDb(filePath: string): EventDatabase {
  const db = sqlite.open(filePath);

  db.query(
    `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    message TEXT NOT NULL
  );
`,
  ).get();

  const insertStmt = db.prepare("INSERT INTO events (id, message) VALUES ($id, $message)");

  return {
    getById(id: number) {
      return db.query("SELECT * FROM events WHERE id = $id").get({ $id: id }) as JourneyCommittedEvent;
    },

    getBlock(from: number, to: number) {
      return db
        .query<
          SavedEvent,
          {
            $from: number;
            $to: number;
          }
        >("SELECT * FROM events WHERE id > $from AND id <= $to")
        .all({ $from: from, $to: to })
        .flatMap((event: SavedEvent) => {
          const data = JSON.parse(event.message) as JourneyCommittedEvent[];
          return data;
        }) as JourneyCommittedEvent[];
    },

    persistBatch(events: Message[]) {
      const trx = db.transaction(() => {
        for (const event of events) {
          insertStmt.run({
            $id: event.id,
            $message: event.data,
          });
        }
      });

      trx();
    },
  };
}
