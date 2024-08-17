function readConfig<T>(key: string, defaultValue: string, transformFn: (value: string) => T): T {
  return transformFn(process.env[key] ?? defaultValue);
}

export const IDLE_TIME = readConfig("IDLE_TIME", "30000", Number);
export const MAX_IDLE_TIME = readConfig("MAX_IDLE_TIME", "900000", Number);
export const BATCH_SIZE = readConfig("BATCH_SIZE", "256", Number);
export const MAX_CHUNK_SIZE = readConfig("MAX_CHUNK_SIZE", "1048576", Number);
export const MAX_CHUNK_COUNT = readConfig("MAX_CHUNK_COUNT", "2000", Number);
