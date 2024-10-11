import fs from "node:fs/promises";
import hash_sum from "hash-sum";
// @ts-ignore
import type { Yaml } from "@types/mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown, frontmatterToMarkdown } from "mdast-util-frontmatter";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import getEventsFromAst from "./getEventsFromAst";

export default async function rewriteChecksum(filePath: string) {
  const fileContent = await fs.readFile(filePath, "utf8");

  // get all events from the markdown file
  const ast = fromMarkdown(fileContent, {
    extensions: [frontmatter(["yaml"])],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
  });

  const events = getEventsFromAst(ast.children);

  const newHash = hash_sum(events);

  const yamlNode = ast.children.find((node): node is Yaml => node.type === "yaml");

  if (!yamlNode) {
    throw new Error("Invalid file format");
  }

  // rewrite the checksum
  const parsedYaml = yaml.parse(yamlNode.value);
  parsedYaml.checksum = newHash;

  yamlNode.value = yaml.stringify(parsedYaml);

  const newMarkdown = toMarkdown(ast, {
    extensions: [frontmatterToMarkdown(["yaml"])],
  });

  await fs.writeFile(filePath, newMarkdown);
}
