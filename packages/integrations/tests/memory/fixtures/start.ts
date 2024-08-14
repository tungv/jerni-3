import begin from "@jerni/jerni-3/lib/begin";
import init from "./init";

const ctrl = new AbortController();

// call server.stop when process is killed
process.on("SIGINT", () => {
  ctrl.abort();
  process.exit(0);
});
// call server.stop ctrl + c is pressed
process.on("SIGTERM", () => {
  ctrl.abort();
  process.exit(0);
});

const journey = await init();
for await (const _outputs of begin(journey, ctrl.signal)) {
  // console.log("outputs", outputs);
}

// keep alive
setInterval(() => {}, 1000);
