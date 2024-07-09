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

export default async function initWorker(filePath: string | undefined) {
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

    const job: Job = {
      async start() {
        await startHealthCheckServer(ctrl.signal);

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

async function startHealthCheckServer(signal: AbortSignal) {
  const server = Bun.serve({
    port: 3000,

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

  signal.addEventListener(
    "abort",
    () => {
      const closeAllActiveConnections = true;
      server.stop(closeAllActiveConnections);
    },
    {
      once: true,
    },
  );
}
