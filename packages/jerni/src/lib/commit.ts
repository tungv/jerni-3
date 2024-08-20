import { nanoid } from "nanoid";
import { readPackageUpSync } from "read-package-up";
import type { Logger } from "../types/Logger";
import type {
  CommittingEventDefinitions,
  JourneyCommittedEvent,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "../types/events";

const parentPackage = readPackageUpSync();

export default async function commitToServer<T extends keyof CommittingEventDefinitions>(
  logger: Logger,
  url: URL,
  logSafeUrl: URL,
  onReport: (type: string, payload: unknown) => void,
  onError: (error: Error, event: JourneyCommittedEvent) => void,
  eventToCommit: ToBeCommittedJourneyEvent<T>,
): Promise<TypedJourneyCommittedEvent<T>> {
  logger.debug("committing...");
  const commitUrl = new URL("commit", url);

  const localId = nanoid();
  const event = {
    ...eventToCommit,
    meta: {
      ...(typeof eventToCommit.meta === "object" ? eventToCommit.meta : { eventMeta: eventToCommit.meta }),
      local_id: localId,
      committed_at: Date.now(),
      server_url: logSafeUrl.toString(),
    } as {
      local_id: string;
      committed_at: number;
      server_url: string;
      [key: string]: unknown;
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

  const res = await fetch(commitUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": localId,
    },
    body: JSON.stringify(event),
  });

  // the only reasonable response is 201
  // for now, accept 200 as well
  if (res.status !== 201 && res.status !== 200) {
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

  const committedEvent = (await res.json()) as TypedJourneyCommittedEvent<T>;
  onReport("committed", {
    event_local_id: localId,
    event_server_id: committedEvent.id,
    duration,
  });

  logger.info("committed event: #%d - %s", committedEvent.id, committedEvent.type);
  return committedEvent;
}
