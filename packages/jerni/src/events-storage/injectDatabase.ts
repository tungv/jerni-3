import type { JourneyCommittedEvent } from "jerni/type";
import getSqliteDb from "src/events-storage/sqlite-database";
import setup from "src/asynclocal";

export interface EventDatabase {
  getEventsFrom(lastEventId: number, limit?: number): Promise<JourneyCommittedEvent[]>;
  insertEvents(events: JourneyCommittedEvent[]): Promise<void>;
}

async function getDB() {
  return getSqliteDb();
}

const store = setup<EventDatabase>(getDB);

export const injectEventDatabase = store.inject;
export const getEventDatabase = store.get;
