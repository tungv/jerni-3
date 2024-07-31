import { bold, green, red } from "picocolors";
import InvalidInputError from "./InvalidInputError";
import { assertFilePath } from "./assertFilePath";
import begin from "./begin";
import { ERR, INF } from "./cli-utils/log-headers";
import { printErrorObject } from "./printErrorObject";

interface Job {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export default async function initWorker(filePath: string | undefined, port: number) {
  // validate file path

  const validFilePath = await assertFilePath(filePath);

  console.log("%s jerni start %s", INF, bold(validFilePath));

  const { default: initializer } = await import(validFilePath);

  // check if initializer is an async function
  if (typeof initializer !== "function") {
    throw new InvalidInputError(
      `Input file does not export a function as its default export

 ${red("- expected")}: export default async function initializer() { ... }
 ${green("+   actual")}: export ${printErrorObject(initializer)}`,
      "start",
    );
  }

  try {
    // try to run initializer to get the journey object
    const journey = await initializer();

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

    const job: Job = {
      async start() {
        startHealthCheckServer(port, ctrl.signal);

        for await (const _outputs of begin(journey, ctrl.signal)) {
          // console.log("outputs", outputs);
        }
      },

      async stop() {
        ctrl.abort();
      },
    };

    return job;
  } catch (error) {
    console.error("%s cannot initialize journey object", ERR);

    throw error;
  }
}

// create a http server that return status code 200 when it's ready
// the server also take a signal to stop the server
// should use Bun.server to create the server

async function startHealthCheckServer(port: number, signal: AbortSignal) {
  const server = Bun.serve({
    port,

    fetch(_req) {
      return new Response("OK", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    },
  });

  console.log("%s health check server is running at %s", INF, bold("http://localhost:3000"));

  const closeAllActiveConnections = true;

  signal.addEventListener(
    "abort",
    () => {
      server.stop(closeAllActiveConnections);
    },
    {
      once: true,
    },
  );
}
