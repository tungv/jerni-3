import fs from "node:fs";
import path from "node:path";
// @ts-expect-error No type declaration
// Due to https://github.com/dividab/tsconfig-paths-webpack-plugin/issues/104
// I downgraded enhanced-resolve to 4.5.0 as suggested. 4.5.0 does not have .d.ts files yet
import { CachedInputFileSystem, ResolverFactory } from "enhanced-resolve";
import { init, parse } from "es-module-lexer";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import type { Tagged } from "type-fest";

type AbsoluteFilePath = Tagged<string, "AbsoluteFilePath">;

const pathResolver = ResolverFactory.createResolver({
  // Typical usage will consume the `fs` + `CachedInputFileSystem`, which wraps Node.js `fs` to add caching.
  fileSystem: new CachedInputFileSystem(fs, 4000),
  extensions: [".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".cts", ".mts", ".json"],

  // If you're using allowJs in tsconfig.json, or allow other non-TS extensions in webpack,
  // make sure you set extensions option in sync with your webpack config.
  plugins: [new TsconfigPathsPlugin({})],
});

/**
 * @param entryFile Path to the entry file. Can be relative or absolute path
 */
export default async function getFilesToWatch(entryFile: string): Promise<AbsoluteFilePath[]> {
  const rootFile = path.resolve(entryFile) as AbsoluteFilePath;

  // traverse imported modules recursively to get list of files to watch
  const filesToWatch: AbsoluteFilePath[] = [];
  const nodes: AbsoluteFilePath[] = [rootFile];
  const visited = new Set<AbsoluteFilePath>();

  while (nodes.length > 0) {
    const node = nodes.pop();
    if (!node) {
      break;
    }
    if (visited.has(node)) {
      continue;
    }
    // ignore if it's in node_module
    if (isNodeModule(node)) {
      continue;
    }

    // todo: ignore if core modules

    visited.add(node);
    filesToWatch.push(node);
    const imported = await getImportedModulesInFile(node);
    nodes.push(...imported);
  }

  return filesToWatch;
}

async function getImportedModulesInFile(file: AbsoluteFilePath): Promise<AbsoluteFilePath[]> {
  const absoluteDir = path.dirname(file);
  // read content of srcFile
  // todo: handle error
  const code = fs.readFileSync(file, "utf-8");

  // find all static imports and dynamic imports
  await init;
  const [imports] = parse(code);
  const relativeImportPaths = imports.flatMap((importSpecifier) => (importSpecifier.n ? [importSpecifier.n] : []));

  const absoluteImportPaths = await Promise.allSettled(
    // todo: handle errors
    relativeImportPaths.map(async (relativeImportPath) => {
      const { promise, resolve, reject } = Promise.withResolvers<AbsoluteFilePath>();
      // @ts-expect-error No type declaration
      pathResolver.resolve({}, absoluteDir, relativeImportPath, {}, (err, result) => {
        if (err) {
          console.warn(`Error resolving "${relativeImportPath}" in "${absoluteDir}"`);
          reject(err);
        } else {
          if (result) {
            resolve(result);
          } else {
            console.warn(`Error resolving "${relativeImportPath}" in "${absoluteDir}"`);
            reject(new Error("No result"));
          }
        }
      });
      return promise;
    }),
  ).then((results) => results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])));

  return absoluteImportPaths;
}

function isNodeModule(node: string) {
  return node.includes("node_modules");
}
