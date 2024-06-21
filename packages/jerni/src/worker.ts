import { bold, green, red } from "picocolors";
import InvalidInputError from "./InvalidInputError";
import { ERR, INF } from "./cli-utils/log-headers";
import { assertFilePath } from "./assertFilePath";
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
        for await (const _outputs of journey.begin(ctrl.signal)) {
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
