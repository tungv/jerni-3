import fs from "node:fs/promises";
import path from "node:path";
import { Mutex, withTimeout } from "async-mutex";

function getCleanStartRequestFilePath(devFilesDir: string): string {
  return path.join(devFilesDir, ".clean-start-requested");
}

const cleanStartMutex = withTimeout(new Mutex(), 10_000);

export async function requestCleanStart(devFilesDir: string) {
  const startTime = Date.now();
  console.log(`[cleanStartRequestHelpers] trying to acquire cleanStartMutex for requestCleanStart`);
  await cleanStartMutex.runExclusive(async () => {
    const acquireTime = Date.now();
    console.log(
      `[cleanStartRequestHelpers] acquired cleanStartMutex for requestCleanStart after ${acquireTime - startTime}ms`,
    );
    const cleanStartFilePath = getCleanStartRequestFilePath(devFilesDir);

    await fs.writeFile(cleanStartFilePath, "true", "utf8");
  });

  const releaseTime = Date.now();
  console.log(
    `[cleanStartRequestHelpers] cleanStartMutex released for requestCleanStart after ${releaseTime - startTime}ms`,
  );
}

export async function hasCleanStartRequest(devFilesDir: string): Promise<boolean> {
  const startTime = Date.now();
  // Wait for any ongoing write operations to complete, but don't acquire the lock
  console.log(`[cleanStartRequestHelpers] waiting for cleanStartMutex for hasCleanStartRequest`);
  await cleanStartMutex.waitForUnlock();
  const releaseTime = Date.now();
  console.log(
    `[cleanStartRequestHelpers] cleanStartMutex released for hasCleanStartRequest after ${releaseTime - startTime}ms`,
  );

  try {
    const cleanStartFilePath = getCleanStartRequestFilePath(devFilesDir);
    await fs.access(cleanStartFilePath);
    return true;
  } catch {
    return false;
  }
}

export async function markCleanStartDone(devFilesDir: string) {
  const startTime = Date.now();
  console.log(`[cleanStartRequestHelpers] trying to acquire cleanStartMutex for markCleanStartDone`);
  await cleanStartMutex.runExclusive(async () => {
    const acquireTime = Date.now();
    console.log(
      `[cleanStartRequestHelpers] acquired cleanStartMutex for markCleanStartDone after ${acquireTime - startTime}ms`,
    );
    const cleanStartFilePath = getCleanStartRequestFilePath(devFilesDir);
    try {
      await fs.unlink(cleanStartFilePath);
    } catch {
      // File doesn't exist, which is fine
    }
  });

  const releaseTime = Date.now();
  console.log(
    `[cleanStartRequestHelpers] cleanStartMutex released for markCleanStartDone after ${releaseTime - startTime}ms`,
  );
}
