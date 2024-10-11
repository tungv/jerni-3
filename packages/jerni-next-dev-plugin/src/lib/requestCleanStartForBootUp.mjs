/**
 * Jerni dev will read `globalThis.__JERNI_BOOTED_UP__` to determine whether to
 * make a clean start when `createJourney()` invoked as a boot up to sync markdown file,
 * sqlite file and data in stores.
 */
export function requestCleanStartForBootUp() {
  globalThis.__JERNI_BOOTED_UP__ = true;
}

export function shouldCleanStartForBootUp() {
  return globalThis.__JERNI_BOOTED_UP__ === true;
}

export function markBootUpCleanStartDone() {
  globalThis.__JERNI_BOOTED_UP__ = false;
}
