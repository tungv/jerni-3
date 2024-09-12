import fs from "node:fs/promises";
import hash_sum from "hash-sum";
import yaml from "yaml";
import type { JourneyCommittedEvent } from "../types/events";
import type { SavedData } from "./readFile";

export default async function appendEventsToFileAsync(filePath: string, events: JourneyCommittedEvent[]) {
  const fileContent = await fs.readFile(filePath, { encoding: "utf8" });

  const parsedContent = yaml.parse(fileContent) as SavedData;

  parsedContent.events.push(...events);

  const newHash = hash_sum(parsedContent.events);
  parsedContent.checksum = newHash;

  const stringifiedContent = yaml.stringify(parsedContent);

  await fs.writeFile(filePath, stringifiedContent);

  return parsedContent.events.length;
}
