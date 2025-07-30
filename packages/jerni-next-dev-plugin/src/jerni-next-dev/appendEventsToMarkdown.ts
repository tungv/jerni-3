import fs from "node:fs/promises";
import type { ToBeCommittedJourneyEvent } from "@jerni/jerni-3/types";
import hash_sum from "hash-sum";
import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown, frontmatterToMarkdown } from "mdast-util-frontmatter";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import { withWriteLock } from "./file-lock";
import getEventsFromAst from "./getEventsFromAst";

export default async function appendEventsToMarkdown(filePath: string, events: ToBeCommittedJourneyEvent[]) {
  return withWriteLock(async () => {
    const fileContent = await fs.readFile(filePath, { encoding: "utf8" });

    const ast = fromMarkdown(fileContent, {
      extensions: [frontmatter(["yaml"])],
      mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
    });

    for (const event of events) {
      addEventToAst(ast, event);
    }

    const allEvents = getEventsFromAst(ast.children as Root["children"]);

    const checksum = hash_sum(allEvents);

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

    return allEvents.length;
  });
}

function addEventToAst(ast: Root, event: ToBeCommittedJourneyEvent) {
  ast.children.push({
    type: "html",
    value: `<details><summary>${event.type}</summary>`,
  });

  ast.children.push({
    type: "code",
    lang: "jsonc",
    meta: "type=event",
    value: `${JSON.stringify(event, null, 2)}`,
  });

  ast.children.push({
    type: "html",
    value: "</details>",
  });
}
