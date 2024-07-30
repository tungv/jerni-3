import begin from "@jerni/jerni-3/lib/begin";
import type { JourneyInstance } from "@jerni/jerni-3/types";
import { nanoid } from "nanoid";

export default async function startWorker(journey: JourneyInstance, signal: AbortSignal) {
  const eventDbName = `jerni_integration_test_events_${nanoid()}`;

  process.env.EVENTS_DB_MONGODB_URL = "mongodb://127.0.0.1:27017";
  process.env.EVENTS_DB_MONGODB_NAME = eventDbName;

  for await (const events of begin(journey, signal)) {
    // console.log("events", events);
  }
}
