import { $ } from "bun";

import path from "node:path";

const pathToCliSrc = path.resolve(import.meta.dir, "../../../jerni/src/cli.ts");
const pathToLinuxBinary = path.resolve(import.meta.dir, "./fixtures/cli-linux");

// build linux binary
await $`bun build --compile ${pathToCliSrc} --outfile ${pathToLinuxBinary} --target bun-linux-arm64`;

console.log("linux binary is built at", pathToLinuxBinary);

// run docker compose

await $`docker compose build`;
await $`docker compose up`;
