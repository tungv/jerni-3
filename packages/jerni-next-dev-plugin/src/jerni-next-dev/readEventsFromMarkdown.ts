import fs from "node:fs/promises";
import type { JourneyCommittedEvent } from "@jerni/jerni-3/types";
import hash_sum from "hash-sum";
import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import { withReadLock } from "./file-lock";
import getEventsFromAst from "./getEventsFromAst";

interface ReadEventsFromMarkDownResult {
  events: JourneyCommittedEvent[];
  fileChecksum: string;
  realChecksum: string;
}

export default async function readEventsFromMarkdown(filePath: string): Promise<ReadEventsFromMarkDownResult> {
  return withReadLock(async () => {
    const doc = await fs.readFile(filePath, { encoding: "utf8" });

    const ast = fromMarkdown(doc, {
      extensions: [frontmatter(["yaml"])],
      mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
    });

    if (ast.children.length === 0 || ast.children[0].type !== "yaml") {
      throw new Error("missing frontmatter");
    }

    const fileChecksum = yaml.parse(ast.children[0].value).checksum;
    const events = getEventsFromAst(ast.children as Root["children"]);
    const realChecksum = hash_sum(events);

    return {
      events,
      fileChecksum,
      realChecksum,
    };
  }, "readEventsFromMarkdown");
}
