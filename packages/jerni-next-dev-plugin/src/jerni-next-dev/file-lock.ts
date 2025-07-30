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
export async function withReadLock<T>(fn: () => Promise<T>): Promise<T> {
  // wait for write mutex to be released, but do not acquire it so that other readers can still read the file
  await writeMutex.waitForUnlock();

  const mutex = createReadMutex();
  const release = await mutex.acquire();

  try {
    return await fn();
  } finally {
    release();
  }
}

// write lock is used to prevent concurrent reads and writes to the same file
export async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  // acquire write mutex to block all readers
  const releaseWrite = await writeMutex.acquire(1);

  // wait for all readers to release their locks
  await Promise.all(readMutexes.map((mutex) => mutex.waitForUnlock()));
  // release all read mutexes
  readMutexes.length = 0;
  try {
    return await fn();
  } finally {
    releaseWrite();
  }
}
