#!/usr/bin/env node

// take the argument from command line to see if bumping major, minor or patch
// then update the version in package.json and jsr.json
// the version has the format of v1.2.3 in package.json and 1.2.3 in jsr.json

import fs from "node:fs";
import { resolve as _resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = _resolve(__dirname, "..");

const bump = process.argv[2];
function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}
function bumpMinor(version) {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}
function bumpMajor(version) {
  const [major] = version.split(".").map(Number);
  return `${major + 1}.0.0`;
}

function bumpPackageJSON() {
  const packageJSONPath = _resolve(rootDir, "package.json");

  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, "utf-8"));

  const currentVersion = packageJSON.version.slice(1);
  let newVersion = currentVersion;
  if (bump === "patch") {
    newVersion = bumpPatch(currentVersion);
  } else if (bump === "minor") {
    newVersion = bumpMinor(currentVersion);
  } else if (bump === "major") {
    newVersion = bumpMajor(currentVersion);
  }

  packageJSON.version = `v${newVersion}`;

  fs.writeFileSync(packageJSONPath, JSON.stringify(packageJSON, null, 2));
}

function bumpJsrJSON() {
  const jsrJSONPath = _resolve(rootDir, "jsr.json");

  const jsrJSON = JSON.parse(fs.readFileSync(jsrJSONPath, "utf-8"));

  const currentVersion = jsrJSON.version;
  let newVersion = currentVersion;
  if (bump === "patch") {
    newVersion = bumpPatch(currentVersion);
  } else if (bump === "minor") {
    newVersion = bumpMinor(currentVersion);
  } else if (bump === "major") {
    newVersion = bumpMajor(currentVersion);
  }

  jsrJSON.version = newVersion;

  fs.writeFileSync(jsrJSONPath, JSON.stringify(jsrJSON, null, 2));
}

bumpPackageJSON();
bumpJsrJSON();
