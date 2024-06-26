import { Database } from "bun:sqlite";
import type { JourneyCommittedEvent } from "jerni/type";
import type { EventDatabase } from "./injectDatabase";

const db = new Database("mydb.sqlite");

export default function getSqliteDb(): EventDatabase {
  const createQuery = db.query(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);

  createQuery.get();

  return {
    getEventsFrom: async (lastEventId: number): Promise<JourneyCommittedEvent[]> => {
      const query = db.query("SELECT * FROM events WHERE id > $lastEventId ORDER BY id ASC");
      const events = query.all({ $lastEventId: lastEventId }) as JourneyCommittedEvent[];

      return events.map((event) => ({
        ...event,
        payload: JSON.parse(event.payload),
      }));
    },

    insertEvents: async (events: JourneyCommittedEvent[]) => {
      const insertQuery = db.prepare("INSERT INTO events (id ,type, payload) VALUES ($id, $type, $payload)");

      for (const event of events) {
        insertQuery.run({
          $id: event.id,
          $type: event.type,
          $payload: JSON.stringify(event.payload),
        });
      }
    },
  };
}
