import { bold, green, red } from "picocolors";
import InvalidInputError from "../InvalidInputError";
import { assertFilePath } from "../assertFilePath";
import begin from "../begin";
import { ERR, INF } from "../cli-utils/log-headers";
import dispose from "../dispose";
import { printErrorObject } from "../printErrorObject";
import type { JourneyInstance } from "../types/journey";

interface StartJerniDevOptions {
  cleanStart?: boolean;
}

export default async function initiateJerniDev(filePath: string | undefined) {
  const validFilePath = await assertFilePath(filePath);

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

  let ctrl: AbortController;
  let started = false;

  return {
    start: async (options?: StartJerniDevOptions) => {
      const cleanStart = options?.cleanStart || false;

      try {
        if (started) {
          console.log("%s jerni dev is already started", INF);
          return;
        }

        started = true;

        // try to run initializer to get the journey object
        const journey = (await initializer()) as JourneyInstance;

        if (cleanStart) {
          console.log("%s clean start jerni, clearing database…", INF);

          // clear database
          await dispose(journey);
        }

        console.log("%s jerni dev start %s", INF, bold(validFilePath));

        ctrl = new AbortController();

        ctrl.signal.addEventListener(
          "abort",
          () => {
            console.log("%s jerni dev is stopped", INF);
            started = false;
          },
          { once: true },
        );

        for await (const _outputs of begin(journey, ctrl.signal)) {
          // console.log("outputs", outputs);
        }
      } catch (error) {
        console.error("%s cannot initialize journey object", ERR);

        throw error;
      }
    },
    stop: async () => {
      if (!started || !ctrl) {
        console.log("%s jerni dev is not started yet", INF);
        return;
      }

      ctrl.abort();
    },
  };
}
