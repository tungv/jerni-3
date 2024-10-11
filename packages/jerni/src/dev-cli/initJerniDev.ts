import { inspect } from "node:util";
import { bold, green, red } from "picocolors";
import InvalidInputError from "../InvalidInputError";
import { assertFilePath } from "../assertFilePath";
import begin from "../begin";
import { ERR, INF } from "../cli-utils/log-headers";
import { printErrorObject } from "../printErrorObject";
import type { JourneyInstance } from "../types/journey";
import clearData from "./clearData";

interface StartJerniDevOptions {
  cleanStart?: boolean;
}

export default async function initJerniDev(filePath: string | undefined) {
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

  let ctrl: AbortController | undefined;
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
          await clearData(journey);
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

        for await (const outputs of begin(journey, ctrl.signal)) {
          // Any store can be used here, we don't have the exact output contract
          console.log(
            "%s output: %O",
            INF,
            inspect(outputs, { depth: 2, colors: true, compact: 1, breakLength: Number.POSITIVE_INFINITY }),
          );
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

      ctrl = undefined;
    },
  };
}
