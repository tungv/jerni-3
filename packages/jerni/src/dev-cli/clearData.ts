import type { JourneyInstance } from "@jerni/jerni-3/types";

export default async function clearDatabase(journey: JourneyInstance) {
  const config = journey.getConfig();

  for (const store of config.stores) {
    await store.clean();
  }
}
