import { MongoClient } from "mongodb";
import type { JourneyCommittedEvent } from "../types/events";
import type { EventDatabase } from "./injectDatabase";

interface SavedEvent {
  id: number;
  type: string;
  payload: unknown;
}

interface Snapshot {
  id: string;
  LAST_EVENT_ID: number;
}

interface MongodbConfig {
  url: string;
  dbName: string;
}

export default async function getMongodbDatabase({ dbName, url }: MongodbConfig): Promise<EventDatabase> {
  const client = await MongoClient.connect(url);
  const db = client.db(dbName);

  return {
    getEventsFrom: async (eventId: number, limit = 200): Promise<JourneyCommittedEvent[]> => {
      const events = await db
        .collection<SavedEvent>("events")
        .find({ id: { $gte: eventId } })
        .limit(limit)
        .toArray();

      return events.map((event) => ({
        id: event.id,
        type: event.type,
        payload: event.payload,
      })) as JourneyCommittedEvent[];
    },

    streamEventsFrom: async function* (eventId: number, limit = 200): AsyncGenerator<JourneyCommittedEvent[]> {
      let currentId = eventId;

      while (true) {
        const events = await db
          .collection<SavedEvent>("events")
          // greater or equal to lastEventId
          .find({ id: { $gte: currentId } })
          .limit(limit)
          .toArray();

        if (events.length === 0) {
          return;
        }

        yield events.map((event) => ({
          id: event.id,
          type: event.type,
          payload: event.payload,
        })) as JourneyCommittedEvent[];

        currentId = events[events.length - 1].id + 1;
      }
    },

    insertEvents: async (includeListHash, events: JourneyCommittedEvent[]) => {
      // upsert events
      await db.collection<SavedEvent>("events").bulkWrite(
        events.map((event) => ({
          updateOne: {
            filter: { id: event.id },
            update: {
              $set: {
                id: event.id,
                type: event.type,
                payload: event.payload,
              },
            },
            upsert: true,
          },
        })),
      );

      // update snapshot
      const lastEventId = events[events.length - 1].id;
      await db.collection<Snapshot>("snapshot").updateOne(
        { id: includeListHash },
        {
          $set: {
            LAST_EVENT_ID: lastEventId,
          },
        },
        { upsert: true },
      );
    },

    getLatestEventId: async (includeListHash) => {
      const row = await db.collection<Snapshot>("snapshot").findOne({ id: includeListHash });

      return row ? row.LAST_EVENT_ID : 0;
    },

    clean: async () => {
      // delete all events
      await db.collection("events").deleteMany({});

      // delete all snapshots
      await db.collection("snapshot").deleteMany({});
    },

    dispose: async () => {
      // terminate connection
      await client.close();
    },
  };
}
