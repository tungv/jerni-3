import { INF } from "./cli-utils/log-headers";
import guardErrors from "./guardErrors";
import startWorker from "./worker";

console.log("%s jerni client is starting...", INF);

const [_bun, _script, fileName] = process.argv;

await guardErrors(
  async () => {
    const job = await startWorker(fileName);

    await job.start();
  },
  () => {
    console.error("%s jerni client is shutting down…", INF);
    process.exit(1);
  },
);
