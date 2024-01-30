import InvalidInputError from "./InvalidInputError";

export async function assertFilePath(
  filePath: string | undefined,
): Promise<string> {
  if (typeof filePath !== "string") {
    throw new InvalidInputError("File path must be a string", "start");
  }

  try {
    const res = Bun.resolveSync(filePath, process.cwd());
    return res;
  } catch (ex) {
    throw new InvalidInputError(`File "${filePath}" does not exist`, "start");
  }
}
