export function getDevFilesDir(): string {
  // @ts-expect-error
  return globalThis.__JERNI_DEV_FILES_DIR__;
}

export function getEventsFilePath(): string {
  // @ts-expect-error
  return globalThis.__JERNI_EVENTS_FILE_PATH__;
}
