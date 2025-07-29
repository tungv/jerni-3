export function getDevFilesDir(): string {
  // @ts-expect-error
  return globalThis.__JERNI_DEV_FILES_DIR__;
}
