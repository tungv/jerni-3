import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJerniNextDevPlugin from "./createJerniNextPlugin.mjs";

/**
 * @param {import("next").NextConfig} nextConfig
 * @param {Object} devConfig
 * @param {string} devConfig.initializerPath
 * @param {string} devConfig.eventsFile
 * @returns {import("next").NextConfig}
 */
export default async function withJerniNextDev(nextConfig, { initializerPath, eventsFile }) {
  const initializerAbsoluteFilePath = path.resolve(process.cwd(), initializerPath);
  const eventsFileAbsolutePath = path.resolve(process.cwd(), eventsFile);
  const sqliteFileAbsolutePath = path.resolve(process.cwd(), "events.sqlite");

  const jerniDevPlugin = await createJerniNextDevPlugin({
    initializerAbsoluteFilePath,
    eventsFileAbsolutePath,
    sqliteFileAbsolutePath,
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

      const { isServer, dev } = options;

      if (isServer && dev) {
        // Apply alias to resolve `@jerni/jerni-3` to `jerni-next-dev-plugin/jerni-next-dev`
        if (webpackConfig.resolve.alias["@jerni/jerni-3$"]) {
          // warn if alias is already defined
          console.warn("[jerni-next-dev] Alias `@jerni/jerni-3$` is overridden by `jerni-next-dev-plugin`.");
        }
        webpackConfig.resolve.alias["@jerni/jerni-3$"] = "jerni-next-dev-plugin/jerni-next-dev";

        // WORKAROUND: mark `better-sqlite3` as external package in order to load it at runtime instead of bundling it
        // to overcome the issue that `bindings` package throws error
        webpackConfig.externals = Array.isArray(webpackConfig.externals)
          ? ["better-sqlite3", ...webpackConfig.externals]
          : ["better-sqlite3"];

        // Define the global variables dynamically
        // IMPORTANT: there is another runtime value `globalThis.__JERNI_EVENTS__` in `jerni-next-dev`
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
            "globalThis.__JERNI_SQL_FILE_PATH__": options.webpack.DefinePlugin.runtimeValue(() => {
              return JSON.stringify(sqliteFileAbsolutePath); // todo: should be internal in node_modules?
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
