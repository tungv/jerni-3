import begin from "@jerni/jerni-3/lib/begin";
import type { JourneyInstance } from "@jerni/jerni-3/types";

export default async function startWorker(journey: JourneyInstance, signal: AbortSignal) {
  for await (const events of begin(journey, signal)) {
    // console.log("events", events);

    return events;
  }
}
