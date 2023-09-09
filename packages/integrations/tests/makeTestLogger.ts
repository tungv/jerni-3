export default function makeTestLogger() {
  const logs: string[][] = [];
  return {
    debug: (...msg: any[]) => {
      // logs.push(msg);
    },
    log: (...msg: any[]) => {
      logs.push(msg);
    },
    warn: (...msg: any[]) => {
      logs.push(msg);
    },
    info: (...msg: any[]) => {
      logs.push(msg);
    },
    error: (...msg: any[]) => {
      logs.push(msg);
    },
    logs,
  };
}
