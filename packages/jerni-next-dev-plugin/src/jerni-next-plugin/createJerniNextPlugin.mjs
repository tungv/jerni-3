import path from "node:path";
import scheduleCleanStartJerni from "./cleanStartJerniDev.mjs";
import getFilesToWatch from "./getFilesToWatch.mjs";
import ensureMarkdownFileExists from "@jerni/jerni-3/dev-cli/ensureMarkdownFileExists";
import { requestCleanStartForBootUp } from "./requestCleanStartForBootUp.mjs";

export default async function createJerniNextPlugin(config) {
  const { initializerAbsoluteFilePath, eventsFileAbsolutePath, sqliteFileAbsolutePath } = config;

  ensureMarkdownFileExists(eventsFileAbsolutePath);

  requestCleanStartForBootUp();

  /**
   * Get modules imported in the initializer file
   * @type {string[]}
   */
  let jerniDeps = await getFilesToWatch(initializerAbsoluteFilePath).then((files) =>
    files.concat(eventsFileAbsolutePath),
  );

  // sync binary and clean start
  await scheduleCleanStartJerni(eventsFileAbsolutePath, sqliteFileAbsolutePath);

  return function jerniNextPlugin() {
    // watchRun hook executes a plugin during watch mode after
    // a new compilation is triggered but before the compilation is actually started
    this.hooks.watchRun.tapPromise("jerni-next-plugin", async (compiler) => {
      const changed = this.modifiedFiles ?? [];
      const removed = this.removedFiles ?? [];

      const changedFiles = new Set([...changed, ...removed]);

      if (changedFiles.size > 0 && jerniDeps.some((file) => changedFiles.has(file))) {
        // todo: check this condition covers the below case `changedFiles.has(eventsFileAbsolutePath)`
        // reinitialize files to watch
        jerniDeps = await getFilesToWatch(initializerAbsoluteFilePath);
        // sync binary and clean start
        await scheduleCleanStartJerni(eventsFileAbsolutePath, sqliteFileAbsolutePath);
      }

/**
 * Jerni dev will read `globalThis.__JERNI_BOOTED_UP__` to determine whether to
 * make a clean start when `createJourney()` invoked as a boot up to sync markdown file,
 * sqlite file and data in stores.
 */
function requestCleanStartForBootUp() {
  globalThis.__JERNI_BOOTED_UP__ = true;
}
