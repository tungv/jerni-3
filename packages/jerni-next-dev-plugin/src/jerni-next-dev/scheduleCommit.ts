import type { ToBeCommittedJourneyEvent } from "@jerni/jerni-3/types";
import { nanoid } from "nanoid";
import appendEventsToMarkdown from "./appendEventsToMarkdown";
import { getNextEventId } from "./eventIdManager";

const buffer: ToBeCommittedJourneyEvent[] = [];

const MAX_BUFFER_SIZE = 10;
const DEBOUNCE_MS = 1000;

async function flush(filePath: string, commitId: string) {
  // empty the buffer to prepare for the flush and make sure other concurrent scheduleCommitEvents calls are not affected
  const toBeFlushed = [...buffer];
  buffer.length = 0;

  if (timeoutId) {
    // clear the previous timeout since we are going to flush immediately
    console.log(`[scheduleCommit-${commitId}] Clearing existing timeout before flushing`);
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  console.log(`[scheduleCommit-${commitId}] Starting flush of ${toBeFlushed.length} events`);
  await appendEventsToMarkdown(filePath, toBeFlushed);
  console.log(`[scheduleCommit-${commitId}] Flush completed for ${toBeFlushed.length} events`);
}

let timeoutId: NodeJS.Timeout | null = null;

export async function scheduleCommitEvents(filePath: string, event: ToBeCommittedJourneyEvent) {
  const commitId = nanoid();

  const thisEventId = await getNextEventId(commitId);

  console.log(`[scheduleCommit-${commitId}] Scheduling event. Buffer size: ${buffer.length}`);
  buffer.push(event);
  console.log(`[scheduleCommit-${commitId}] Added event to buffer. New buffer size: ${buffer.length}`);

  console.log(`[scheduleCommit-${commitId}] Next event ID will be: ${thisEventId}`);

  // if the buffer is full, we need to flush the buffer
  if (buffer.length >= MAX_BUFFER_SIZE) {
    console.log(
      `[scheduleCommit-${commitId}] Buffer full (${buffer.length} >= ${MAX_BUFFER_SIZE}), flushing immediately`,
    );

    void flush(filePath, commitId);

    return thisEventId;
  }

  // if the buffer is not full, we need to schedule a timeout to flush the buffer

  // but first, need to clear the previous timeout if there are any
  console.log(`[scheduleCommit-${commitId}] Timeout ID: ${timeoutId}`);
  if (timeoutId) {
    console.log(`[scheduleCommit-${commitId}] Clearing previous timeout`);
    clearTimeout(timeoutId);
  }

  console.log(`[scheduleCommit-${commitId}] Scheduling timeout flush in ${DEBOUNCE_MS}ms.`);

  timeoutId = setTimeout(async () => {
    console.log(`[scheduleCommit-setTimeout-${commitId}] Timeout triggered, flushing ${buffer.length} events`);
    console.log(`[scheduleCommit-setTimeout-${commitId}] This event ID: ${thisEventId}`);
    void flush(filePath, commitId);
  }, DEBOUNCE_MS);

  return thisEventId;
}
