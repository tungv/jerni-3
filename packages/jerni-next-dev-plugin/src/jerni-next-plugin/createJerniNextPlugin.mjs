import path from "node:path";
import getFilesToWatch from "./getFilesToWatch.mjs";
import ensureMarkdownFileExists from "@jerni/jerni-3/dev-cli/ensureMarkdownFileExists";
import { requestCleanStartForBootUp } from "../lib/requestCleanStartForBootUp.mjs";

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

  return function jerniNextPlugin() {
    // watchRun hook executes a plugin during watch mode after
    // a new compilation is triggered but before the compilation is actually started
    this.hooks.watchRun.tapPromise("jerni-next-plugin", async (compiler) => {
      const changed = this.modifiedFiles ?? [];
      const removed = this.removedFiles ?? [];
      const changedFiles = new Set([...changed, ...removed]);

      if (changedFiles.size > 0 && jerniDeps.some((file) => changedFiles.has(file))) {
        // createJourney() will be reloaded hence it's ok to use requestCleanStartForBootUp()
        requestCleanStartForBootUp();
        // reinitialize files to watch
        jerniDeps = await getFilesToWatch(initializerAbsoluteFilePath);
      }
    });
  };
}
