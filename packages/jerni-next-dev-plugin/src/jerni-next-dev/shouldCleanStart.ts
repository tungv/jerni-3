import { hasCleanStartRequest } from "./cleanStartRequestHelpers";
import { getDevFilesDir } from "./getDevFilesUtils";

/**
 * This function should only be called in the plugin code, not from the user's code
 * Check if there is a clean start request
 */
export default async function shouldCleanStart(): Promise<boolean> {
  const devFilesDir = getDevFilesDir();
  return hasCleanStartRequest(devFilesDir);
}
