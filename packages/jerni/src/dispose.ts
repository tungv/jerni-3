import { getEventDatabase, injectEventDatabase } from "./events-storage/injectDatabase";
import type { JourneyInstance } from "./types/journey";

const defaultLogger = console;

export default injectEventDatabase(async function dispose(journey: JourneyInstance) {
  const config = journey.getConfig();

  const { logger = defaultLogger } = config;

  logger.debug("Disposing journey...");

  // dispose all stores
  for (const store of config.stores) {
    await store.clean();
  }

  // dispose all events stored
  await getEventDatabase().dispose();
});
