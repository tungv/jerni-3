import appendEventsToFileAsync from "@jerni/jerni-3/dev-cli/appendEventsToMarkdown";
import writeEventToSqlite from "./writeEventToSqlite.mjs";

export default async function commitEvent(sqliteFilePath, textFilePath, events) {
  const lastId = await writeEventToSqlite(sqliteFilePath, events);

  // append events to text file in the background
  await appendEventsToFileAsync(textFilePath, events);

  return lastId;
}
