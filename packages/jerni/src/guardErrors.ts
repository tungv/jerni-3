import { bold } from "picocolors";
import InvalidInputError from "./InvalidInputError";
import { ERR } from "./cli-utils/log-headers";

export default async function guardErrors<TReturn>(
  computation: () => Promise<TReturn>,
  catcher?: (error: unknown) => void,
) {
  try {
    return await computation();
  } catch (error) {
    if (error instanceof InvalidInputError) {
      console.error("%s jerni failed to run", ERR);
      console.error(
        "%s %s for command %s: %s",
        ERR,
        bold("[Invalid Input]"),
        bold(error.command),
        error.message,
      );
    } else {
      console.error(error);
    }

    if (typeof catcher === "function") {
      catcher(error);
    }
  }
}
