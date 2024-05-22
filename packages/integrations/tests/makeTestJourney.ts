import makeTestLogger from "./makeTestLogger";
import type { JourneyConfig } from "jerni/type";
import createJourney from "jerni";
import type { JourneyCommittedEvent } from "@jerni/store-mongodb/lib/src/types";
import { mock } from "bun:test";

export default async function initJourney(
  stores: JourneyConfig["stores"],
  serverPort: number,
  onError?: (error: Error, event: JourneyCommittedEvent) => void,
) {
  const logger = makeTestLogger();

  const onReport = mock((type: string, payload: unknown) => {});

  const journey = createJourney({
    server: `http://localhost:${serverPort}`,
    // server,
    stores,
    onError: (error, event) => {
      return onError?.(error, event);
    },
    onReport: (reportType, reportData) => {
      onReport(reportType, reportData);
    },
    logger,
  });

  return {
    journey,
    logger,
    onReport,
  };
}
