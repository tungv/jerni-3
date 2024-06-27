import { Database } from "bun:sqlite";
import type { JourneyCommittedEvent } from "jerni/type";
import type { EventDatabase } from "../injectDatabase";
import { mock } from "bun:test";

const db = new Database(":memory:");

function getSqliteDb(): EventDatabase {
  const tableName = `events_${Math.random().toString(36).slice(2)}`;

  const createQuery = db.query(`
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);

  createQuery.get();

  return {
    getEventsFrom: async (lastEventId: number, limit = 200): Promise<JourneyCommittedEvent[]> => {
      const query = db.prepare(`SELECT * FROM ${tableName} WHERE id > $lastEventId ORDER BY id ASC LIMIT $limit`);
      const events = query.all({ $lastEventId: lastEventId, $limit: limit }) as JourneyCommittedEvent[];

      return events.map((event) => ({
        ...event,
        payload: JSON.parse(event.payload as string),
      }));
    },

    insertEvents: async (events: JourneyCommittedEvent[]) => {
      const insertQuery = db.prepare(`INSERT INTO ${tableName} (id ,type, payload) VALUES ($id, $type, $payload)`);

      for (const event of events) {
        insertQuery.run({
          $id: event.id,
          $type: event.type,
          $payload: JSON.stringify(event.payload),
        });
      }
    },

    streamEventsFrom: async function* (lastEventId: number, limit = 200): AsyncGenerator<JourneyCommittedEvent[]> {
      const query = db.prepare(`SELECT * FROM ${tableName} WHERE id > $lastEventId ORDER BY id ASC LIMIT $limit`);

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

    getLatestEventId: async () => {
      const query = db.query(`SELECT MAX(id) as maxId FROM ${tableName}`);
      const { maxId } = query.get() as { maxId: number };

      return maxId || 0;
    },
  };
}

mock.module("src/events-storage/sqlite-database", () => ({
  default: getSqliteDb,
}));
