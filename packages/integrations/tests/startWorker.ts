import type { JourneyInstance } from "jerni/type";

export default async function startWorker(journey: JourneyInstance, signal: AbortSignal) {
  for await (const events of journey.begin(signal)) {
    // console.log("events", events);
  }
}
