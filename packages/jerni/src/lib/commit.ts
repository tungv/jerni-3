import { nanoid } from "nanoid";
import { readPackageUpSync } from "read-pkg-up";
import { Logger } from "src/types/Logger";
import {
  TypedJourneyCommittedEvent,
  TypedJourneyEvent,
} from "src/types/events";

const parentPackage = readPackageUpSync();

export default async function commitToServer<T extends string>(
  logger: Logger,
  url: URL,
  logSafeUrl: URL,
  onReport: (type: string, payload: any) => void,
  onError: (error: Error) => void,
  eventToCommit: TypedJourneyEvent<T>,
): Promise<TypedJourneyCommittedEvent<T>> {
  logger.log("committing...");
  const commitUrl = new URL("commit", url);

  const localId = nanoid();
  const event = {
    ...eventToCommit,
    meta: {
      ...eventToCommit.meta,
      local_id: localId,
      committed_at: Date.now(),
      server_url: logSafeUrl.toString(),
    },
  };

  if (parentPackage) {
    event.meta.client = parentPackage.packageJson.name;
    event.meta.client_version = parentPackage.packageJson.version;
  }

  onReport("committing", {
    event,
    event_local_id: localId,
  });

  const res = await fetch(commitUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": localId,
    },
    body: JSON.stringify(event),
  });

  // the only reasonable response is 201
  if (res.status !== 201) {
    onReport("commit_failed", {
      event_local_id: localId,
      status: res.status,
      status_text: res.statusText,
    });

    // FIXME: we should retry here
    // However, we cannot retry if the server does not support deduplication using x-request-id

    throw new Error("failed to commit");
  }

  const committedSuccessfullyAt = Date.now();
  const duration = committedSuccessfullyAt - event.meta.committed_at;

  const committedEvent: TypedJourneyCommittedEvent<T> = await res.json();
  onReport("committed", {
    event_local_id: localId,
    event_server_id: committedEvent.id,
    duration,
  });

  logger.info(
    "[JERNI | INF] committed event: #%d - %s",
    committedEvent.id,
    committedEvent.type,
  );
  return committedEvent;
}
