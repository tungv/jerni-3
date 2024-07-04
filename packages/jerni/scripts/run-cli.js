#!/usr/bin/env node

import download from "./download-binary.js";

// run the binary with the arguments from the command line
import { spawn } from "node:child_process";
import { resolve as _resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binaryPath = _resolve(__dirname, "../mycli");

await download(binaryPath);

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code);
});
