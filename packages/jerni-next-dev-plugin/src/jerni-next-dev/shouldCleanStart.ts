export function shouldCleanStart(): boolean {
  // @ts-expect-error
  return globalThis.CLEAN_START_JERNI;
}
