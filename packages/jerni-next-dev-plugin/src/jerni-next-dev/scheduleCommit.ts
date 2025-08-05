import type { ToBeCommittedJourneyEvent } from "@jerni/jerni-3/types";
import appendEventsToMarkdown from "./appendEventsToMarkdown";
import { getNextEventId } from "./sqliteEventIdManager";

/**
 * Commit an event to the events file directly, support multiple concurrent commits.
 * @param filePath - The path to the events file.
 * @param event - The event to be committed.
 * @returns The ID of the committed event.
 */
export async function scheduleCommitEvents(filePath: string, event: ToBeCommittedJourneyEvent) {
  const thisEventId = getNextEventId();

  await appendEventsToMarkdown(filePath, [event]);

  return thisEventId;
}
