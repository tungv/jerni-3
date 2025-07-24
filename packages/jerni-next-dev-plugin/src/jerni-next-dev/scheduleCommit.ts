import type { ToBeCommittedJourneyEvent } from "@jerni/jerni-3/types";
import appendEventsToMarkdown from "./appendEventsToMarkdown";
import { withLock } from "./file-lock";
import readEventsFromMarkdown from "./readEventsFromMarkdown";

const buffer = new Map<string, ToBeCommittedJourneyEvent[]>();
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

const BUFFER_SIZE = 10;
const DEBOUNCE_MS = 1000;

async function flush(filePath: string) {
  const events = buffer.get(filePath);
  if (!events || events.length === 0) {
    return;
  }

  await withLock(filePath, async () => {
    await appendEventsToMarkdown(filePath, events);
  });

  eventsInFileSize = null;

  buffer.set(filePath, []);
  const timeoutId = timeouts.get(filePath);
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeouts.delete(filePath);
  }
}

let eventsInFileSize: number | null = null;

export async function scheduleCommitEvents(filePath: string, events: ToBeCommittedJourneyEvent[]) {
  // in the first time schedule, we need to read the file to get the event size
  if (eventsInFileSize === null) {
    const { events } = await readEventsFromMarkdown(filePath);
    eventsInFileSize = events.length;
  }

  let existing = buffer.get(filePath);
  if (!existing) {
    existing = [];
    buffer.set(filePath, existing);
  }

  existing.push(...events);

  const newId = eventsInFileSize + existing.length;

  if (existing.length >= BUFFER_SIZE) {
    await flush(filePath);
  } else {
    const timeoutId = timeouts.get(filePath);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeouts.set(
      filePath,
      setTimeout(() => flush(filePath), DEBOUNCE_MS),
    );
  }

  return newId;
}
