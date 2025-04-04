import type { Logger } from "./types";

export const defaultLogger: Logger = console;

export function makeTestLogger(): Logger {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  const debugs: string[] = [];
  const infos: string[] = [];

  return {
    debug(...args: unknown[]) {
      debugs.push(args.join(" "));
      console.debug(...args);
    },
    info(...args: unknown[]) {
      infos.push(args.join(" "));
      console.info(...args);
    },
    log(...args: unknown[]) {
      logs.push(args.join(" "));
      console.log(...args);
    },
    warn(...args: unknown[]) {
      warns.push(args.join(" "));
      console.warn(...args);
    },
    error(...args: unknown[]) {
      errors.push(args.join(" "));
      console.error(...args);
    },
    // test helper methods
    getLogs: () => [...logs],
    getWarns: () => [...warns],
    getErrors: () => [...errors],
    clearLogs: () => {
      logs.length = 0;
      warns.length = 0;
      errors.length = 0;
      debugs.length = 0;
      infos.length = 0;
    },
  };
}
