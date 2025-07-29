import { Mutex, type MutexInterface, withTimeout } from "async-mutex";

// Only one file, so we use singletons
const writeMutex = withTimeout(new Mutex(), 10_000);
function createReadMutex(): MutexInterface {
  const mutex = withTimeout(new Mutex(), 10_000);
  readMutexes.push(mutex);

  return mutex;
}

const readMutexes: MutexInterface[] = [];

// read lock is used to prevent concurrent writes to the same file, but does not prevent concurrent reads
export async function withReadLock<T>(fn: () => Promise<T>, fnName: string): Promise<T> {
  const startTime = Date.now();

  // wait for write mutex to be released, but do not acquire it so that other readers can still read the file
  console.log(`[withReadLock] waiting for write mutex for ${fnName}`);
  await writeMutex.waitForUnlock();
  console.log(`[withReadLock] wait for write mutex completed for ${fnName} after ${Date.now() - startTime}ms`);

  const mutex = createReadMutex();
  const release = await mutex.acquire();

  try {
    return await fn();
  } finally {
    console.log(`[withReadLock] releasing read mutex for ${fnName} after ${Date.now() - startTime}ms`);
    release();
  }
}

// write lock is used to prevent concurrent reads and writes to the same file
export async function withWriteLock<T>(fn: () => Promise<T>, fnName: string): Promise<T> {
  const startTime = Date.now();
  // acquire write mutex to block all readers
  console.log(`[withWriteLock] waiting for write mutex for ${fnName}`);
  const releaseWrite = await writeMutex.acquire(1);
  console.log(`[withWriteLock] acquired write mutex for ${fnName} after ${Date.now() - startTime}ms`);

  // wait for all readers to release their locks
  console.log(`[withWriteLock] waiting for read mutex for ${fnName}`);
  await Promise.all(readMutexes.map((mutex) => mutex.waitForUnlock()));
  console.log(`[withWriteLock] acquired read mutex for ${fnName} after ${Date.now() - startTime}ms`);
  // release all read mutexes
  readMutexes.length = 0;
  try {
    return await fn();
  } finally {
    console.log(`[withWriteLock] Releasing write mutex for ${fnName} after ${Date.now() - startTime}ms`);
    releaseWrite();
  }
}
