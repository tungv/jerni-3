import fs from "node:fs";
import path from "node:path";

function getCleanStartRequestFilePath(devFilesDir: string): string {
  return path.join(devFilesDir, ".clean-start-requested");
}

export async function requestCleanStart(devFilesDir: string) {
  const cleanStartFilePath = getCleanStartRequestFilePath(devFilesDir);

  fs.writeFileSync(cleanStartFilePath, "true", "utf8");
}

export async function hasCleanStartRequest(devFilesDir: string): Promise<boolean> {
  try {
    const cleanStartFilePath = getCleanStartRequestFilePath(devFilesDir);
    fs.accessSync(cleanStartFilePath);

    return true;
  } catch {
    return false;
  }
}

export async function markCleanStartDone(devFilesDir: string) {
  const cleanStartFilePath = getCleanStartRequestFilePath(devFilesDir);
  try {
    fs.unlinkSync(cleanStartFilePath);
  } catch {
    // File doesn't exist, which is fine
  }
}
