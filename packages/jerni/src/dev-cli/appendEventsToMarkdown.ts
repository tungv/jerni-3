import fs from "node:fs/promises";
import hash_sum from "hash-sum";
import type { Code, Yaml } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown, frontmatterToMarkdown } from "mdast-util-frontmatter";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import type { ToBeCommittedJourneyEvent } from "../types/events";
import getEventsFromAst from "./getEventsFromAst";

export default async function appendEventsToMarkdown(filePath: string, events: ToBeCommittedJourneyEvent[]) {
  const fileContent = await fs.readFile(filePath, { encoding: "utf8" });

  // parse the file content as markdown using import { fromMarkdown } from "mdast-util-from-markdown";
  const ast = fromMarkdown(fileContent, {
    extensions: [frontmatter(["yaml"])],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
  });

  // append the events to the markdown, event node are jsonc with meta ?type=events
  for (const event of events) {
    const eventNode = {
      type: "code",
      lang: "jsonc",
      value: JSON.stringify(event),
      meta: "?type=events",
    } as Code;

    ast.children.push(eventNode);
  }

  const allEvents = getEventsFromAst(ast.children);

  const checksum = hash_sum(allEvents);

  // override the checksum in the frontmatter, it is the first node in the ast
  const frontmatterNode = ast.children[0];
  if (frontmatterNode.type !== "yaml") {
    throw new Error("frontmatter node not found");
  }
  const parsedFrontmatter = yaml.parse(frontmatterNode.value);
  parsedFrontmatter.checksum = checksum;
  frontmatterNode.value = yaml.stringify(parsedFrontmatter);

  const newMarkdown = toMarkdown(ast, {
    extensions: [frontmatterToMarkdown(["yaml"])],
  });

  await fs.writeFile(filePath, newMarkdown);
}
