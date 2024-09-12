import fs from "node:fs";
import hash_sum from "hash-sum";
import yaml from "yaml";
import type { JourneyCommittedEvent } from "../types/events";

export type SavedData = {
  checksum: string;

  events: JourneyCommittedEvent[];
};

export default function readFile(filePath: string) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedContent = yaml.parse(fileContent) as SavedData;

  return {
    events: parsedContent.events,
    fileChecksum: parsedContent.checksum,
    realChecksum: hash_sum(parsedContent.events),
  };
}
