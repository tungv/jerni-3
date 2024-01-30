export function printErrorObject(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "function") {
    return error.name;
  }

  if (error == null) {
    return "null";
  }

  if (Array.isArray(error)) {
    return `Array[${error.length}]`;
  }

  if (typeof error === "object") {
    const keys = Object.keys(error);
    return `Object { ${keys.slice(0, 3).join(", ")} ${
      keys.length > 3 ? "…" : ""
    } }`;
  }

  return JSON.stringify(error);
}
