import { Database } from "bun:sqlite";
import { mock } from "bun:test";
import type { JourneyCommittedEvent } from "../../types/events";
import type { EventDatabase } from "../injectDatabase";

const db = new Database(":memory:");

interface SavedEvent {
  id: number;
  type: string;
  payload: string;
}

function getSqliteDb(): EventDatabase {
  const eventsTableName = `events_${Math.random().toString(36).slice(2)}`;
  const snapshotTableName = `snapshot_${Math.random().toString(36).slice(2)}`;

  db.query(
    `
  CREATE TABLE IF NOT EXISTS ${eventsTableName} (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`,
  ).get();

  db.query(
    `
  CREATE TABLE IF NOT EXISTS ${snapshotTableName} (
    id TEXT PRIMARY KEY,
    LAST_EVENT_ID INTEGER NOT NULL
  );
`,
  ).get();

  return {
    getEventsFrom: async (eventId: number, limit = 200): Promise<JourneyCommittedEvent[]> => {
      const query = db.prepare(
        `SELECT * FROM ${eventsTableName} WHERE id >= $lastEventId ORDER BY id ASC LIMIT $limit`,
      );
      const events = query.all({ $lastEventId: eventId, $limit: limit }) as SavedEvent[];

      return events.map((event) => ({
        ...event,
        payload: JSON.parse(event.payload as string),
      })) as JourneyCommittedEvent[];
    },

    insertEvents: async (includeListHash, events: JourneyCommittedEvent[]) => {
      // upsert events
      const insertQuery = db.prepare(
        `INSERT OR REPLACE INTO ${eventsTableName} (id, type, payload) VALUES ($id, $type, $payload)`,
      );

      for (const event of events) {
        insertQuery.run({
          $id: event.id,
          $type: event.type,
          $payload: JSON.stringify(event.payload),
        });
      }

      const lastEventId = events[events.length - 1].id;
      const query = db.prepare(
        `INSERT OR REPLACE INTO ${snapshotTableName} (id, LAST_EVENT_ID) VALUES ($id, $lastEventId)`,
      );
      query.run({ $id: includeListHash, $lastEventId: lastEventId });
    },

    streamEventsFrom: async function* (eventId: number, limit = 200): AsyncGenerator<JourneyCommittedEvent[]> {
      // greater or equal to lastEventId
      const query = db.prepare(
        `SELECT * FROM ${eventsTableName} WHERE id >= $lastEventId ORDER BY id ASC LIMIT $limit`,
      );

      let currentId = eventId;

      while (true) {
        const events = query.all({ $lastEventId: currentId, $limit: limit }) as SavedEvent[];

        if (events.length === 0) {
          return;
        }

        yield events.map((event) => ({
          ...event,
          payload: JSON.parse(event.payload as string),
        })) as JourneyCommittedEvent[];

        currentId = events[events.length - 1].id + 1;
      }
    },

    getLatestEventId: async (includeListHash) => {
      const query = db.prepare(`SELECT LAST_EVENT_ID FROM ${snapshotTableName} WHERE id = $id`);
      const row = query.get({ $id: includeListHash }) as { LAST_EVENT_ID: number } | undefined;

      return row ? row.LAST_EVENT_ID : 0;
    },

    clean: async () => {
      // delete from if exists
      db.query(`DELETE FROM ${eventsTableName}`).get();
      db.query(`DELETE FROM ${snapshotTableName}`).get();
    },

    dispose: async () => {
      // close connection
      db.close();
    },
  };
}

mock.module("src/events-storage/sqlite-database", () => ({
  default: getSqliteDb,
}));
