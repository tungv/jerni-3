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
      console.log("Binary already exists");

      return resolve();
    }

    // read the version from jsr.json relative to this script using `fs`
    const JsrJson = fs.readFileSync(_resolve(__dirname, "../jsr.json"), "utf-8");
    const { version } = JSON.parse(JsrJson);

    console.log(`Downloading Binary v${version} for ${os} ${currentArch}`);

    const url = `https://github.com/tungv/jerni-3/releases/download/v${version}/jerni-${suffix}`;

    const file = fs.createWriteStream(dest);

    function sendRequest(url) {
      get(url, (response) => {
        // automatically follow the redirect
        if (response.statusCode === 302) {
          sendRequest(response.headers.location);

          return;
        }

        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            console.log("Download completed");

            file.close(resolve);
          });

          return;
        }

        reject(new Error(`Error downloading file: ${response.statusCode} ${response.statusMessage}`));
        console.error("Error downloading file:", response.statusCode);
      });
    }

    sendRequest(url);
  });

await download(_resolve(__dirname, "../jerni"));

export default download;
