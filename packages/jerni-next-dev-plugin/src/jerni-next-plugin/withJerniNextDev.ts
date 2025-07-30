import path from "node:path";
import type { NextConfig } from "next";
import createJerniNextDevPlugin from "./createJerniNextPlugin";

/**
 * Configuration options for Jerni Next.js development plugin
 */
interface JerniNextDevOptions {
  /** Path to the jerni initializer file */
  initializerPath: string;
  /** Path to the markdown events file */
  eventsFile: string;
  /** Directory to store dev files (event ID, initial backup). Defaults to events file directory. */
  devFilesDir: string;
}

/**
 * Configures Next.js to work with Jerni development mode
 * @param nextConfig - The Next.js configuration object
 * @param options - Jerni development configuration options
 * @returns Enhanced Next.js configuration with Jerni development support
 */
export default async function withJerniNextDev(
  nextConfig: NextConfig,
  options: JerniNextDevOptions,
): Promise<NextConfig> {
  const initializerAbsoluteFilePath = path.resolve(process.cwd(), options.initializerPath);
  const eventsFileAbsolutePath = path.resolve(process.cwd(), options.eventsFile);

  // Determine the directory for dev files - either specified or default to events file directory
  const devFilesDirAbsolutePath = path.resolve(process.cwd(), options.devFilesDir);

  const jerniDevPlugin = await createJerniNextDevPlugin({
    initializerAbsoluteFilePath,
    eventsFileAbsolutePath,
    devFilesDirAbsolutePath,
  });

  const extendedConfig: NextConfig = {
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
      const webpackConfig = typeof nextConfig.webpack === "function" ? nextConfig.webpack(config, options) : config;

      const { isServer } = options;

      if (isServer) {
        // Ensure resolve.alias exists
        if (!webpackConfig.resolve) {
          webpackConfig.resolve = {};
        }
        if (!webpackConfig.resolve.alias) {
          webpackConfig.resolve.alias = {};
        }

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

        // Ensure plugins array exists
        if (!webpackConfig.plugins) {
          webpackConfig.plugins = [];
        }

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
