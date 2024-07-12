import type { JourneyInstance } from "@jerni/jerni-3/types";
import begin from "jerni/lib/begin";

export default async function startWorker(journey: JourneyInstance, signal: AbortSignal) {
  for await (const events of begin(journey, signal)) {
    // console.log("events", events);
  }
}
