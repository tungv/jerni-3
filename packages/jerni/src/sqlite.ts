import sqlite from "bun:sqlite";
import type { Message } from "./getMessage";
import type { JourneyCommittedEvent } from "./types/events";

export interface EventDatabase {
  getBlock(from: number, to: number): JourneyCommittedEvent[];
  persistBatch(events: Message[]): void;
}

interface SavedEvent {
  id: number;
  message: string;
}

type Database = ReturnType<typeof sqlite.open>;

export default function makeDb(filePath: string): EventDatabase {
  function withDb<T>(callback: (db: Database) => T): T {
    const db = sqlite.open(filePath);

    try {
      return callback(db);
    } finally {
      db.close();
    }
  }

  withDb((db) => {
    db.query(
      `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    message TEXT NOT NULL
  );
`,
    ).get();
  });

  return {
    getBlock(from: number, to: number) {
      return withDb((db) => {
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
      });
    },

    persistBatch(events: Message[]) {
      return withDb((db) => {
        const trx = db.transaction(() => {
          const insertStmt = db.prepare("INSERT INTO events (id, message) VALUES ($id, $message)");
          for (const event of events) {
            insertStmt.run({
              $id: event.id,
              $message: event.data,
            });
          }
        });

        trx();
      });
    },
  };
}
