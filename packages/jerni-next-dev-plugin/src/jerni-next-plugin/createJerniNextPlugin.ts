import fs from "node:fs/promises";
import ensureMarkdownFileExists from "@jerni/jerni-3/dev-cli/ensureMarkdownFileExists";
import type { Compiler } from "webpack";

import { requestCleanStart } from "../jerni-next-dev/cleanStartRequestHelpers";
import readEventsFromMarkdown from "../jerni-next-dev/readEventsFromMarkdown";
import getFilesToWatch from "./getFilesToWatch.mjs";

type JerniNextPluginConfig = {
  initializerAbsoluteFilePath: string;
  eventsFileAbsolutePath: string;
  devFilesDirAbsolutePath: string;
};

export default async function createJerniNextPlugin(config: JerniNextPluginConfig) {
  const { devFilesDirAbsolutePath } = config;
  // Create the dev files directory if it doesn't exist
  await fs.mkdir(devFilesDirAbsolutePath, { recursive: true });

  // should always clean start on startup
  await requestCleanStart(devFilesDirAbsolutePath);

  return new JerniNextPlugin(config);
}

class JerniNextPlugin {
  private config: JerniNextPluginConfig;

  constructor(config: JerniNextPluginConfig) {
    this.config = config;
  }

  async apply(compiler: Compiler) {
    const { initializerAbsoluteFilePath, eventsFileAbsolutePath, devFilesDirAbsolutePath } = this.config;

    ensureMarkdownFileExists(eventsFileAbsolutePath);

    /**
     * Get modules imported in the initializer file
     * This ONLY work in dev mode (npm run dev), since in production mode, webpack does not watch the files anymore
     * For production mode, we need to trigger the clean start manually using resetEventsFileAndCleanStart function
     */
    let jerniDeps: string[] = await getFilesToWatch(initializerAbsoluteFilePath).then((files) =>
      files.concat(eventsFileAbsolutePath),
    );

    compiler.hooks.watchRun.tapPromise("jerni-next-plugin", async () => {
      const changed = compiler.modifiedFiles ?? [];
      const removed = compiler.removedFiles ?? [];
      const changedFiles = new Set([...changed, ...removed]);

      // if the events file is changed, we need to check if the checksum is changed then request clean start
      // This only works in dev mode, since in production mode, webpack does not watch the files anymore
      const { fileChecksum, realChecksum } = await readEventsFromMarkdown(eventsFileAbsolutePath);
      if (fileChecksum !== realChecksum) {
        await requestCleanStart(devFilesDirAbsolutePath);
      }

      if (changedFiles.size > 0 && jerniDeps.some((file) => changedFiles.has(file))) {
        // createJourney() will be reloaded hence it's ok to use requestCleanStart()
        await requestCleanStart(devFilesDirAbsolutePath);
        // reinitialize files to watch
        jerniDeps = await getFilesToWatch(initializerAbsoluteFilePath);
      }
    });
  }
}
