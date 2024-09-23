import fs from "node:fs";
import hash_sum from "hash-sum";
import JSON5 from "json5";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterToMarkdown } from "mdast-util-frontmatter";
import { toMarkdown } from "mdast-util-to-markdown";
import yaml from "yaml";

const newFilePath = process.argv[2] || "./events.md";

const jerniDbPath = "./jerni.db";

const jerniDb = fs.readFileSync(jerniDbPath, "utf8");

// go line by line, keep the lines that does not start with "{"
// for the lines that start with "{", parse the line as a JSON object
// then write the JSON object in a jsonc code block with meta "?type=events"

const ast = fromMarkdown("");

const events = [];
let eventIdx = 1;

for (const line of jerniDb.split("\n")) {
  // skip the old checksum line
  if (line.trim().startsWith("### BEGIN")) {
    continue;
  }

  if (!line.trim() || !line.trim().startsWith("{")) {
    if (line.startsWith("###")) {
      console.log("heading 3");
      ast.children.push({
        type: "heading",
        depth: 3,
        children: [
          {
            type: "text",
            value: line.replace(/^###\s*/, ""),
          },
        ],
      });
    } else if (line.startsWith("##")) {
      console.log("heading 2");
      ast.children.push({
        type: "heading",
        depth: 2,
        children: [
          {
            type: "text",
            value: line.replace(/^##\s*/, ""),
          },
        ],
      });
    } else if (line.startsWith("#")) {
      console.log("heading 1");
      ast.children.push({
        type: "heading",
        depth: 1,
        children: [
          {
            type: "text",
            value: line.replace(/^#\s*/, ""),
          },
        ],
      });
    } else {
      console.log("text");
    }

    ast.children.push({
      type: "text",
      value: "\n",
    });

    continue;
  }

  const event = JSON5.parse(line);

  addEventToAst(ast, event);

  events.push({
    id: eventIdx++,
    ...event,
  });
}

const frontmatter = {
  checksum: hash_sum(events),
};
// insert the frontmatter in the beginning of the ast
ast.children.unshift({
  type: "yaml",
  value: yaml.stringify(frontmatter),
});

const newContent = toMarkdown(ast, {
  extensions: [frontmatterToMarkdown(["yaml"])],
});

fs.writeFileSync(newFilePath, newContent);

function addEventToAst(ast, event) {
  // put the events in a details tag
  ast.children.push({
    type: "html",

    // Add a newline after the opening tag and summary for proper rendering
    // Reference: https://gist.github.com/scmx/eca72d44afee0113ceb0349dd54a84a2?permalink_comment_id=4095967
    value: `\n<details><summary>${event.type}</summary>\n`,
  });

  ast.children.push(
    {
      type: "text",
      value: "\n",
    },
    {
      type: "code",
      lang: "jsonc",
      meta: "?type=events",
      value: `${JSON.stringify(event, null, 2)}`,
    },
  );

  ast.children.push({
    type: "html",
    value: "\n\n</details>",
  });

  ast.children.push({
    type: "text",
    value: "\n\n",
  });
}
