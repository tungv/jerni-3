import { Mutex } from "async-mutex";

const fileLocks = new Map<string, Mutex>();

export function getLock(filePath: string): Mutex {
  let lock = fileLocks.get(filePath);
  if (!lock) {
    lock = new Mutex();
    fileLocks.set(filePath, lock);
  }
  return lock;
}

export async function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const lock = getLock(filePath);
  const release = await lock.acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
