import fs from "node:fs";
import hash_sum from "hash-sum";
import yaml from "yaml";
import type { SavedData } from "./readFile";

export default function rewriteChecksum(filePath: string) {
  // if file does not exist, no need to rewrite checksum
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedContent = yaml.parse(fileContent) as SavedData;

  const newHash = hash_sum(parsedContent.events);
  parsedContent.checksum = newHash;

  const stringifiedContent = yaml.stringify(parsedContent);

  fs.writeFileSync(filePath, stringifiedContent);
}
