import fs from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";

const DIST = "dist";

console.log("Cleaning dist directory...");
try {
  await fs.rm(DIST, { recursive: true });
} catch (ex) {
  // ignore
}

await fs.mkdir(DIST, { recursive: true });

console.log("Compiling TypeScript files...");
await $`tsc --project tsconfig.build.json`;

// copy package.json with adjusted paths
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));

// adjust the paths to point to compiled files
pkg.main = "./dist/index.js";
pkg.types = "./dist/index.d.ts";
pkg.exports = {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./types": {
    "types": "./dist/types.d.ts",
    "default": "./dist/types.js"
  }
};

// ensure files field includes dist
pkg.files = ["dist", "LICENSE.md", "README.md"];

await fs.writeFile(
  path.join(DIST, "package.json"),
  JSON.stringify(pkg, null, 2),
  "utf8"
);

// copy README and LICENSE
try {
  await fs.copyFile("README.md", path.join(DIST, "README.md"));
} catch (ex) {
  console.warn("No README.md found");
}

try {
  await fs.copyFile("LICENSE.md", path.join(DIST, "LICENSE.md"));
} catch (ex) {
  console.warn("No LICENSE.md found");
}

console.log("Build completed successfully!"); 