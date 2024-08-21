import bytes from "bytes";
import ms from "ms";

function readConfig<T>(key: string, defaultValue: string, transformFn: (value: string) => T): T {
  return transformFn(process.env[key] ?? defaultValue);
}

// text/event-stream pulse settings
export const INITIAL_PULSE_COUNT = readConfig("JERNI_CLI_INITIAL_PULSE_COUNT", "256", Number);

// idle time settings
export const INITIAL_IDLE_TIME = readConfig("JERNI_CLI_INITIAL_IDLE_TIME", "30s", ms);
export const MAX_IDLE_TIME = readConfig("JERNI_CLI_MAX_IDLE_TIME", "15m", ms);

// fetch response buffer
export const MAX_STREAMING_BUFFER_SIZE = readConfig("JERNI_CLI_MAX_STREAMING_BUFFER_SIZE", String(bytes("1MB")), bytes);
export const MAX_STREAMING_BUFFER_COUNT = readConfig("JERNI_CLI_MAX_STREAMING_BUFFER_COUNT", "2000", Number);

// event processing settings
export const HANDLING_EVENT_TIMEOUT = readConfig("JERNI_CLI_HANDLING_EVENT_TIMEOUT", "15m", ms);
