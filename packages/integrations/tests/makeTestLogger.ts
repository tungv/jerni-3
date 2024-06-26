export default function makeTestLogger() {
  const logs: string[][] = [];
  return {
    debug: (...msg: string[]) => {
      // logs.push(msg);
    },
    log: (...msg: string[]) => {
      logs.push(msg);
    },
    warn: (...msg: string[]) => {
      logs.push(msg);
    },
    info: (...msg: string[]) => {
      logs.push(msg);
    },
    error: (...msg: string[]) => {
      logs.push(msg);
    },
    logs,
  };
}
