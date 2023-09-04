import startWorker from "./worker";

console.log("jerni client is starting...");

const [_bun, _script, fileName] = process.argv;

const job = await startWorker(fileName);

await job.start();
