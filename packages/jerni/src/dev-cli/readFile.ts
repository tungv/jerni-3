import fs from "node:fs";
import hash_sum from "hash-sum";
import yaml from "yaml";
import type { JourneyCommittedEvent } from "../types/events";

export type SavedData = {
  checksum: string;

  events: JourneyCommittedEvent[];
};

export default function readFile(filePath: string) {
  // check if file exists
  if (!fs.existsSync(filePath)) {
    // if not, create a new file
    // the first line is checksum: $hash of the content

    const content = {
      checksum: "",
      events: [],
    };

    const stringifiedContent = yaml.stringify(content);
    fs.writeFileSync(filePath, stringifiedContent);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedContent = yaml.parse(fileContent) as SavedData;

  return {
    events: parsedContent.events,
    fileChecksum: parsedContent.checksum,
    realChecksum: hash_sum(parsedContent.events),
  };
}
