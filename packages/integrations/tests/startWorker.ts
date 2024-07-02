import begin from "jerni/lib/begin";
import type { JourneyInstance } from "jerni/type";

export default async function startWorker(journey: JourneyInstance, signal: AbortSignal) {
  for await (const events of begin(journey, signal)) {
    // console.log("events", events);
  }
}
