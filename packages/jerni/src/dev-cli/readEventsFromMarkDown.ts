import fs from "node:fs/promises";
import hash_sum from "hash-sum";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import getEventsFromAst from "./getEventsFromAst";

interface ReadEventsFromMarkDownResult {
  events: {
    id: number;
    type: any;
    payload: any;
    meta: any;
  }[];
  /**
   * The checksum written in the markdown file.
   * Expected to be the same as `realChecksum` if the file is not modified.
   */
  fileChecksum: string;
  /**
   * The checksum calculated from all events in the markdown file.
   * Expected to be the same as `fileChecksum` if the file is not modified.
   */
  realChecksum: string;
}

export default async function readEventsFromMarkDown(filePath: string): Promise<ReadEventsFromMarkDownResult> {
  const doc = await fs.readFile(filePath, "utf8");

  const ast = fromMarkdown(doc, {
    extensions: [frontmatter(["yaml"])],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
  });

  // if first child is not yaml, throw error
  if (ast.children.length === 0 || ast.children[0].type !== "yaml") {
    throw new Error("missing frontmatter");
  }

  const fileChecksum = yaml.parse(ast.children[0].value).checksum;

  const events = getEventsFromAst(ast.children);

  const realChecksum = hash_sum(events);

  return {
    events,
    /**
     * The checksum written in the markdown file.
     * Expected to be the same as `realChecksum` if the file is not modified.
     */
    fileChecksum,
    /**
     * The checksum calculated from all events in the markdown file.
     * Expected to be the same as `fileChecksum` if the file is not modified.
     */
    realChecksum,
  };
}
