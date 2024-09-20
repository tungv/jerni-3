import fs from "node:fs/promises";
import hash_sum from "hash-sum";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import getEventsFromAst from "./getEventsFromAst";

export default async function readEventsFromMarkDown(filePath: string) {
  const doc = await fs.readFile(filePath, "utf8");

  const ast = fromMarkdown(doc, {
    extensions: [frontmatter(["yaml"])],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
  });

  // if first child is not yaml, throw error
  if (ast.children.length === 0 || ast.children[0].type !== "yaml") {
    throw new Error("invalid file format");
  }

  const fileChecksum = yaml.parse(ast.children[0].value).checksum;

  const events = getEventsFromAst(ast.children);

  const realChecksum = hash_sum(events);

  return {
    events,
    fileChecksum,
    realChecksum,
  };
}
