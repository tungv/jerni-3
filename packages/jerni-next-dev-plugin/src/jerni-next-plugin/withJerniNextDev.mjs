import fs from "node:fs/promises";
import path from "node:path";
import createJerniNextDevPlugin from "./createJerniNextPlugin.js";

/**
 * @param {import("next").NextConfig} nextConfig
 * @param {Object} devConfig
 * @param {string} devConfig.initializerPath Path to the jerni initializer file
 * @param {string} devConfig.eventsFile Path to the markdown events file
 * @param {string} [devConfig.devFilesDir] Directory to store dev files (event ID, initial backup). Defaults to events file directory.
 * @returns {import("next").NextConfig}
 */
export default async function withJerniNextDev(nextConfig, options) {
  const initializerAbsoluteFilePath = path.resolve(process.cwd(), options.initializerPath);
  const eventsFileAbsolutePath = path.resolve(process.cwd(), options.eventsFile);

  // Determine the directory for dev files - either specified or default to events file directory
  const devFilesDirAbsolutePath = options.devFilesDir
    ? path.resolve(process.cwd(), options.devFilesDir)
    : path.resolve(process.cwd(), ".jerni-dev-files");

  // Create the dev files directory if it doesn't exist
  await fs.mkdir(devFilesDirAbsolutePath, { recursive: true });

  const eventsFileName = path.basename(options.eventsFile);
  const backupPath = path.join(devFilesDirAbsolutePath, `${eventsFileName}.initial`);

  // check if the backup file exists, if not, copy the events file to the backup file
  (async () => {
    try {
      await fs.stat(backupPath);
    } catch {
      await fs.copyFile(eventsFileAbsolutePath, backupPath);
    }
  })();

  const jerniDevPlugin = await createJerniNextDevPlugin({
    initializerAbsoluteFilePath,
    eventsFileAbsolutePath,
    devFilesDirAbsolutePath,
  });

  const extendedConfig = {
    ...nextConfig,

    // in prior to nextjs v15, page router does not bundle external packages.
    // -> load external packages at run time -> load original jerni-3
    // in nextjs v15, page router does not bundle external packages
    // https://nextjs.org/blog/next-15-rc#optimizing-bundling-of-external-packages-stable
    // fixme: next version compatibility
    // fixme: affect production build?
    transpilePackages: Array.isArray(nextConfig.transpilePackages)
      ? ["@jerni/jerni-3", ...nextConfig.transpilePackages]
      : ["@jerni/jerni-3"],

    webpack: (config, options) => {
      // If nextConfig.webpack is a function, call it with config and options.
      // Use this webpack config for further processing.
      const webpackConfig = typeof nextConfig.webpack === "function" ? nextConfig.webpack(config, options) : {};

      const { isServer } = options;

      if (isServer) {
        // Apply alias to resolve `@jerni/jerni-3` to `jerni-next-dev-plugin/jerni-next-dev`
        if (webpackConfig.resolve.alias["@jerni/jerni-3$"]) {
          // warn if alias is already defined
          console.warn("[JERNI-PLUGIN] Alias `@jerni/jerni-3$` is overridden by `jerni-next-dev-plugin`.");
        }
        webpackConfig.resolve.alias["@jerni/jerni-3$"] = "@jerni/jerni-next-dev-plugin/jerni-next-dev";

        // WORKAROUND: mark `better-sqlite3` as external package in order to load it at runtime instead of bundling it
        // to overcome the issue that `bindings` package throws error
        webpackConfig.externals = Array.isArray(webpackConfig.externals)
          ? ["better-sqlite3", ...webpackConfig.externals]
          : ["better-sqlite3"];

        // Define the global variables dynamically
        // IMPORTANT: there is another runtime value `globalThis.__JERNI_BOOTED_UP__` in `jerni-next-dev`
        webpackConfig.plugins.push(
          new options.webpack.DefinePlugin({
            "globalThis.__JERNI_EVENTS_FILE_PATH__": options.webpack.DefinePlugin.runtimeValue(
              () => {
                return JSON.stringify(eventsFileAbsolutePath);
              },
              {
                fileDependencies: [eventsFileAbsolutePath], // watch events file
              },
            ),
          }),
        );

        webpackConfig.plugins.push(
          new options.webpack.DefinePlugin({
            "globalThis.__JERNI_DEV_FILES_DIR__": options.webpack.DefinePlugin.runtimeValue(() => {
              return JSON.stringify(devFilesDirAbsolutePath);
            }),
          }),
        );

        webpackConfig.plugins.push(jerniDevPlugin);
      }

      return webpackConfig;
    },
  };

  return extendedConfig;
}
