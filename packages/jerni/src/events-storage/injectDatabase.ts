import type { JourneyCommittedEvent } from "jerni/type";
import getSqliteDb from "src/events-storage/sqlite-database";
import setup from "src/asynclocal";

export interface EventDatabase {
  getEventsFrom(lastEventId: number, limit?: number): Promise<JourneyCommittedEvent[]>;
  insertEvents(includesListHash: string, events: JourneyCommittedEvent[]): Promise<void>;
  streamEventsFrom(lastEventId: number, limit?: number): AsyncGenerator<JourneyCommittedEvent[]>;

  getLatestEventId(includesListHash: string): Promise<number>;
}

async function getDB() {
  return getSqliteDb();
}

const store = setup<EventDatabase>(getDB);

export const injectEventDatabase = store.inject;
export const getEventDatabase = store.get;
