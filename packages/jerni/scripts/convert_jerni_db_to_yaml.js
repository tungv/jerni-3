// read file jerni.db

import fs from "node:fs";
import hash_sum from "hash-sum";
import yaml from "yaml";

const newFilePath = process.argv[2] || "./events.yaml";

const jerniDbPath = "./jerni.db";

const jerniDb = fs.readFileSync(jerniDbPath, "utf8");

// go line by line, ignore empty lines and lines that start with "#"
const lines = jerniDb.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#"));

// then parse the lines into an array of objects
const events = lines.map((line) => JSON.parse(line));

// write to newFilePath
const content = {
  checksum: hash_sum(events),
  events,
};

fs.writeFileSync(newFilePath, yaml.stringify(content));
