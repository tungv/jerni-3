#!/usr/bin/env node

// run the binary with the arguments from the command line
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import downloadDev from "./download-dev";

// if the argument is init, we need to write the jerni-3.d.ts file that imports the types from jerni
// the file need to be written in the current working directory
if (process.argv[2] === "init") {
  const importStatement = 'import type {} from "@jerni/jerni-3/type";';
  const filePath = resolve(process.cwd(), "jerni-3.d.ts");
  writeFileSync(filePath, importStatement);

  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const binaryPath = resolve(__dirname, "../jerni-dev");

await downloadDev(binaryPath);

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
