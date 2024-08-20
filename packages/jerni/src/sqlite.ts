import sqlite from "bun:sqlite";
import type { Message } from "./getMessage";
import type { JourneyCommittedEvent } from "./types/events";

export interface EventDatabase {
  getBlock(from: number, to: number, maxLength: number): JourneyCommittedEvent[];
  persistBatch(events: Message[]): void;
}

interface SavedEvent {
  id: number;
  message: string;
}

export default function makeDb(filePath: string): EventDatabase {
  const db = sqlite.open(filePath);

  try {
    db.query(
      `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  message TEXT NOT NULL
  );
  `,
    ).get();
  } finally {
    db.close();
  }

  return {
    getBlock(from: number, to: number, maxLength: number) {
      const db = sqlite.open(filePath);
      try {
        return db
          .query<
            SavedEvent,
            {
              $from: number;
              $to: number;
              $maxLength: number;
            }
          >("SELECT * FROM events WHERE id > $from AND id <= $to LIMIT $maxLength")
          .all({ $from: from, $to: to, $maxLength: maxLength })
          .flatMap((event: SavedEvent) => {
            const data = JSON.parse(event.message) as JourneyCommittedEvent[];
            return data;
          })
          .slice(0, maxLength) as JourneyCommittedEvent[];
      } finally {
        db.close();
      }
    },

    persistBatch(events: Message[]) {
      const db = sqlite.open(filePath);
      try {
        const trx = db.transaction(() => {
          // insert or update
          const insertStmt = db.prepare("INSERT OR REPLACE INTO events (id, message) VALUES ($id, $message)");
          for (const event of events) {
            insertStmt.run({
              $id: event.id,
              $message: event.data,
            });
          }
        });

        trx();
      } finally {
        db.close();
      }
    },
  };
}
