import fs from "node:fs/promises";
import hash_sum from "hash-sum";
import jsYaml from "js-yaml";

export default async function appendEventsToFileAsync(filePath, events) {
  const fileContent = await fs.readFile(filePath, { encoding: "utf8" });

  const parsedContent = jsYaml.load(fileContent);

  parsedContent.events.push(...events);

  const newHash = hash_sum(parsedContent.events);
  parsedContent.checksum = newHash;

  const stringifiedContent = jsYaml.dump(parsedContent);

  await fs.writeFile(filePath, stringifiedContent);

  return parsedContent.events.length;
}
