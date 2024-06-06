import { Database } from "bun:sqlite";
import type { JourneyCommittedEvent } from "jerni/type";
import type { EventDatabase } from "./injectDatabase";

const db = new Database("events.sqlite");

export default function getSqliteDb(): EventDatabase {
  // create tables if not exists
  db.query(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`).get();

  db.query(`
  CREATE TABLE IF NOT EXISTS snapshot (
    id TEXT PRIMARY KEY,
    LAST_EVENT_ID INTEGER NOT NULL
  );
`).get();

  return {
    getEventsFrom: async (lastEventId: number, limit = 200): Promise<JourneyCommittedEvent[]> => {
      const query = db.query("SELECT * FROM events WHERE id > $lastEventId ORDER BY id ASC LIMIT $limit");
      const events = query.all({ $lastEventId: lastEventId, $limit: limit }) as JourneyCommittedEvent[];

      return events.map((event) => ({
        ...event,
        payload: JSON.parse(event.payload as string),
      })) as JourneyCommittedEvent[];
    },

    streamEventsFrom: async function* (lastEventId: number, limit = 200): AsyncGenerator<JourneyCommittedEvent[]> {
      const query = db.query("SELECT * FROM events WHERE id > $lastEventId ORDER BY id ASC LIMIT $limit");

      let currentId = lastEventId;

      while (true) {
        const events = query.all({ $lastEventId: currentId, $limit: limit }) as JourneyCommittedEvent[];

        if (events.length === 0) {
          return;
        }

        yield events.map((event) => ({
          ...event,
          payload: JSON.parse(event.payload as string),
        }));

        currentId = events[events.length - 1].id;
      }
    },

    insertEvents: async (includeListHash, events: JourneyCommittedEvent[]) => {
      // upsert events
      const insertQuery = db.prepare("INSERT OR REPLACE INTO events (id, type, payload) VALUES ($id, $type, $payload)");

      for (const event of events) {
        insertQuery.run({
          $id: event.id,
          $type: event.type,
          $payload: JSON.stringify(event.payload),
        });
      }

      // update snapshot
      const lastEventId = events[events.length - 1].id;
      const query = db.prepare("INSERT OR REPLACE INTO snapshot (id, LAST_EVENT_ID) VALUES ($id, $lastEventId)");
      query.run({ $id: includeListHash, $lastEventId: lastEventId });
    },

    getLatestEventId: async (includeListHash) => {
      const query = db.query("SELECT LAST_EVENT_ID FROM snapshot WHERE id = $id");
      const row = query.get({ $id: includeListHash }) as { LAST_EVENT_ID: number } | undefined;

      return row ? row.LAST_EVENT_ID : 0;
    },
  };
}
