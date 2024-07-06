#!/usr/bin/env node

import download from "./download-binary.js";

// run the binary with the arguments from the command line
import { spawn } from "node:child_process";
import { resolve as _resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binaryPath = _resolve(__dirname, "../mycli");

await download(binaryPath);

// need to run chmod +x to make the binary executable
const chmodRun = spawn("chmod", ["+x", binaryPath]);

await new Promise((resolve) => {
  chmodRun.on("exit", (code) => {
    if (code !== 0) {
      console.error("Failed to make the binary executable");
      process.exit(1);
    }

    resolve();
  });
});

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
