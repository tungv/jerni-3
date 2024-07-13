import setup from "../asynclocal";
import type { JourneyCommittedEvent } from "../types/events";
import getMongodbDatabase from "./mongodb-database";
import getSqliteDb from "./sqlite-database";

export interface EventDatabase {
  getEventsFrom(eventId: number, limit?: number): Promise<JourneyCommittedEvent[]>;
  insertEvents(includesListHash: string, events: JourneyCommittedEvent[]): Promise<void>;
  streamEventsFrom(eventId: number, limit?: number): AsyncGenerator<JourneyCommittedEvent[]>;

  getLatestEventId(includesListHash: string): Promise<number>;

  dispose(): Promise<void>;
  clean(): Promise<void>;
}

async function getDB() {
  if (process.env.EVENTS_DB_MONGODB_URL && process.env.EVENTS_DB_MONGODB_NAME) {
    console.log("Using MongoDB as event storage");

    return getMongodbDatabase({
      url: process.env.EVENTS_DB_MONGODB_URL,
      dbName: process.env.EVENTS_DB_MONGODB_NAME,
    });
  }

  console.log("Using SQLite as event storage");
  return getSqliteDb();
}

const store = setup<EventDatabase>(getDB);

export const injectEventDatabase = store.inject;
export const getEventDatabase = store.get;
