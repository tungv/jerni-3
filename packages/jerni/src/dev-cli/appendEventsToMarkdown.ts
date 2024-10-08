import fs from "node:fs/promises";
import hash_sum from "hash-sum";
import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown, frontmatterToMarkdown } from "mdast-util-frontmatter";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import yaml from "yaml";
import type { ToBeCommittedJourneyEvent } from "../types/events";
import getEventsFromAst from "./getEventsFromAst";

// todo: modify CI to build dev tools
export default async function appendEventsToMarkdown(filePath: string, events: ToBeCommittedJourneyEvent[]) {
  const fileContent = await fs.readFile(filePath, { encoding: "utf8" });

  // parse the file content as markdown using import { fromMarkdown } from "mdast-util-from-markdown";
  const ast = fromMarkdown(fileContent, {
    extensions: [frontmatter(["yaml"])],
    mdastExtensions: [frontmatterFromMarkdown(["yaml"])],
  });

  // append the events to the markdown, event node are jsonc with meta type=event
  for (const event of events) {
    addEventToAst(ast, event);
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

/**
 * Adds a journey event to the given markdown AST (Abstract Syntax Tree).
 * The event is added within a <details> HTML tag, with the event type as the summary.
 * The event details are added as a JSONC code block with a meta tag type=event.
 *
 * @example
 * <details><summary>NEW_ACCOUNT_REGISTERED</summary>
 *
 * ```jsonc type=event
 * {
 *   "type": "NEW_ACCOUNT_REGISTERED",
 *   "payload": {
 *     "id": "123",
 *     "name": "test"
 *   },
 *   "meta": {}
 * }
 * ```
 *
 * </details>
 */
function addEventToAst(ast: Root, event: ToBeCommittedJourneyEvent) {
  // put the events in a details tag
  ast.children.push({
    type: "html",

    // Add a newline after the opening tag and summary for proper rendering
    // Reference: https://gist.github.com/scmx/eca72d44afee0113ceb0349dd54a84a2?permalink_comment_id=4095967
    // toMarkdown handled the new line automatically, so we don't need to add a new line here
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
