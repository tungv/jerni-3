import JSON5 from "json5";
import type { Code, RootContent } from "mdast";

export default function getEventsFromAst(ast: RootContent[]) {
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

    return params.get("type") === "events";
  };

  const rawEvents = ast.filter(isEvent);

  return rawEvents.map((event, idx) => {
    const parsed = JSON5.parse(event.value);

    return {
      id: idx + 1,
      type: parsed.type,
      payload: parsed.payload,
      meta: parsed.meta,
    };
  });
}
