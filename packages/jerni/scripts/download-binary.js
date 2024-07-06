#!/usr/bin/env node

import fs from "node:fs";
import { get } from "node:https";
import { arch, platform } from "node:os";
import { resolve as _resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// check the os of the current machine, then download the binary with the correct suffix
const os = platform();
const currentArch = arch();

if (os !== "linux" && os !== "darwin" && os !== "win32") {
  throw new Error("Unsupported OS");
}
if (currentArch !== "x64" && currentArch !== "arm64") {
  throw new Error("Unsupported architecture");
}

const osSuffixMap = {
  linux: "linux",
  darwin: "darwin",
  win32: "win",
};

const suffix = `${osSuffixMap[os]}-${currentArch}`;

const __dirname = dirname(fileURLToPath(import.meta.url));

const download = (dest) =>
  new Promise((resolve, reject) => {
    // check if the file exists
    if (fs.existsSync(dest)) {
      return resolve();
    }

    // read the version from package.json relative to this script using `fs`
    const packageJSON = fs.readFileSync(_resolve(__dirname, "../package.json"), "utf-8");
    const { version } = JSON.parse(packageJSON);

    const url = `https://github.com/tungv/jerni-3/releases/download/${version}/mycli-${suffix}`;

    const file = fs.createWriteStream(dest);

    // download and save the binary
    get(url, (response) => {
      const stream = response.pipe(file);

      stream.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });

const __dirname = dirname(fileURLToPath(import.meta.url));

await download(_resolve(__dirname, "../mycli"));

export default download;
