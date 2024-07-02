import type { JourneyCommittedEvent } from "jerni/type";
import setup from "../asynclocal";
import getSqliteDb from "./sqlite-database";

export interface EventDatabase {
  getEventsFrom(eventId: number, limit?: number): Promise<JourneyCommittedEvent[]>;
  insertEvents(includesListHash: string, events: JourneyCommittedEvent[]): Promise<void>;
  streamEventsFrom(eventId: number, limit?: number): AsyncGenerator<JourneyCommittedEvent[]>;

  getLatestEventId(includesListHash: string): Promise<number>;

  dispose(): Promise<void>;
  clean(): Promise<void>;
}

// TODO: need to provide user with other event database like mongodb or sql so that they can be persisted for later use easier
async function getDB() {
  return getSqliteDb();
}

const store = setup<EventDatabase>(getDB);

export const injectEventDatabase = store.inject;
export const getEventDatabase = store.get;
