export interface Logger {
  debug: Console["debug"];
  log: Console["log"];
  info: Console["info"];
  warn: Console["warn"];
  error: Console["error"];
}
