import { ServerOrWriteTo } from "./types/config";

export default function normalizeUrl(config: ServerOrWriteTo) {
  const serverUrlOrServer = "server" in config ? config.server : config.writeTo;
  const server =
    typeof serverUrlOrServer === "string"
      ? { url: serverUrlOrServer, key: "", secret: "" }
      : serverUrlOrServer;

  const url = new URL(server.url);
  // add trailing slash if needed
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }

  url.username = server.key;
  url.password = server.secret;

  if (!server.secret) {
    return {
      url,
      logSafeUrl: url,
    };
  }

  const masked = new URL(url);
  masked.password = "********";

  return {
    url,
    logSafeUrl: masked,
  };
}
