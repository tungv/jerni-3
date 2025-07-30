import { hasCleanStartRequest } from "./cleanStartRequestHelpers";
import { getDevFilesDir, getEventsFilePath } from "./getDevFilesUtils";
import readEventsFromMarkdown from "./readEventsFromMarkdown";

/**
 * This function should only be called in the plugin code, not from the user's code
 * Check if there is a clean start request before reading data
 */
export async function shouldCleanStartForReader(): Promise<boolean> {
  const devFilesDir = getDevFilesDir();
  return hasCleanStartRequest(devFilesDir);
}

/**
 * Check if there is a clean start request before committing
 * Also need to check if the checksum of the events file are mismatch to clean start
 * Otherwise, the new event will not be projected correctly
 */
export async function shouldCleanStartForCommit(): Promise<boolean> {
  const devFilesDir = getDevFilesDir();
  const cleanStartRequested = await hasCleanStartRequest(devFilesDir);

  const eventsFilePath = getEventsFilePath();
  const { fileChecksum, realChecksum } = await readEventsFromMarkdown(eventsFilePath);
  const checksumMismatch = fileChecksum !== realChecksum;

  return cleanStartRequested || checksumMismatch;
}
