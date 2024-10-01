import JSON5 from "json5";
import type { Code, RootContent } from "mdast";

const isEvent = (node: RootContent): node is Code => {
  if (node.type !== "code") return false;
  if (node.lang !== "jsonc") return false;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(node.meta ?? "");
  } catch (error) {
    // the format is not valid => not an event
    return false;
  }

  if (!params.has("type")) {
    return false;
  }

  return params.get("type") === "event";
};

export default function getEventsFromAst(ast: RootContent[]) {
  let eventIdx = 1;

  return ast.flatMap((node) => {
    if (!isEvent(node)) return [];

    // use JSON5 here incase there are trailing commas in the payload
    const parsed = JSON5.parse(node.value);

    return [
      {
        id: eventIdx++,
        type: parsed.type,
        payload: parsed.payload,
        meta: parsed.meta,
      },
    ];
  });
}
