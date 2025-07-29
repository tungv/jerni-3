import { Mutex, withTimeout } from "async-mutex";
import { promises as fs } from "fs";
import { join } from "path";
import { getDevFilesDir } from "./getDevFilesUtils";

const eventIdMutex = withTimeout(new Mutex(), 10_000);

/**
 * Get the next event ID.
 * @param filePath - The path to the events file.
 * @param commitId - The commit ID.
 * @returns The next event ID.
 *
 * This function is used to get the next event ID. It is used to ensure that the event ID is unique and that it is
 * incremented correctly.
 *
 * Steps:
 * 1. Read the current event ID from the file.
 * 2. If the current event ID is 0, get the initial events size from the file.
 * 3. Increment the current event ID.
 * 4. Write the new event ID back to the file.
 * 5. Return the new event ID.
 *
 * The function is concurrent safe and can be called from multiple processes.
 */
export async function getNextEventId(commitId: string): Promise<number> {
  const startTime = Date.now();
  console.log(`[eventIdManager-${commitId}] Starting acquire eventIdMutex to get next event ID`);
  const nextEventId = await eventIdMutex.runExclusive(async () => {
    const acquireTime = Date.now();
    console.log(
      `[eventIdManager-${commitId}] Acquired eventIdMutex to get next event ID after ${acquireTime - startTime}ms`,
    );

    const currentEventId = await getCurrentEventId();
    console.log(`[eventIdManager-${commitId}] Current event ID from file: ${currentEventId}`);

    // Increment the current event ID
    console.log(`[eventIdManager-${commitId}] Incrementing current event ID, current value: ${currentEventId}`);
    const newEventId = currentEventId + 1;

    // Write the new event ID back to file
    await internalWriteLastEventId(newEventId);
    console.log(`[eventIdManager-${commitId}] Wrote new event ID to file: ${newEventId}`);

    // Return the new event ID
    return newEventId;
  });

  const releaseTime = Date.now();
  console.log(
    `[eventIdManager-${commitId}] Released eventIdMutex to get next event ID after ${releaseTime - startTime}ms`,
  );

  console.log(`[eventIdManager-${commitId}] Next event ID: ${nextEventId}`);

  return nextEventId;
}

async function internalWriteLastEventId(lastEventId: number): Promise<void> {
  const eventIdFilePath = getEventIdFilePath();
  console.log(`[eventIdManager] Writing last event ID ${lastEventId} to ${eventIdFilePath}`);
  await fs.writeFile(eventIdFilePath, lastEventId.toString(), "utf-8");
}

/**
 * Write the last event ID to the file. Used during clean start to reset the event ID counter.
 * This is the exported version so that when it's called in clean start, it will be concurrent safe with other functions in this file.
 * @param lastEventId - The last event ID to write.
 */
export async function writeLastEventId(lastEventId: number): Promise<void> {
  const startTime = Date.now();
  console.log(`[eventIdManager] Trying to acquire eventIdMutex to write last event ID`);
  await eventIdMutex.runExclusive(async () => {
    const acquireTime = Date.now();
    console.log(`[eventIdManager] Acquired eventIdMutex to write last event ID after ${acquireTime - startTime}ms`);
    await internalWriteLastEventId(lastEventId);
  });
  const releaseTime = Date.now();
  console.log(`[eventIdManager] Released eventIdMutex to write last event ID after ${releaseTime - startTime}ms`);
}

/**
 * Get the current event ID from the file without incrementing it.
 * @returns The current event ID.
 */
async function getCurrentEventId(): Promise<number> {
  const eventIdFilePath = getEventIdFilePath();
  try {
    const content = await fs.readFile(eventIdFilePath, "utf-8");
    const id = parseInt(content.trim(), 10);
    return Number.isNaN(id) ? 0 : id;
  } catch {
    // File doesn't exist or can't be read, return 0
    return 0;
  }
}

export function getEventIdFilePath(): string {
  // Use custom dev files directory if provided, otherwise use events file directory
  const dir = getDevFilesDir();
  const eventIdFileName = ".jerni-event-id";
  return join(dir, eventIdFileName);
}
