import fs from "node:fs";
import hash_sum from "hash-sum";
import yaml from "yaml";
import type { JourneyCommittedEvent } from "../types/events";
import type { SavedData } from "./readFile";

export default function appendEventToFile(filePath: string, events: JourneyCommittedEvent[]) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedContent = yaml.parse(fileContent) as SavedData;

  parsedContent.events.push(...events);

  const newHash = hash_sum(parsedContent.events);
  parsedContent.checksum = newHash;

  const stringifiedContent = yaml.stringify(parsedContent);

  fs.writeFileSync(filePath, stringifiedContent);
}
