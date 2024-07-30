import "./mock_read_package_up";

import { mock } from "bun:test";
import type { JourneyConfig } from "@jerni/jerni-3/types";
import type { JourneyCommittedEvent } from "@jerni/store-mongodb/types";
import createJourney from "jerni";
import makeTestLogger from "./makeTestLogger";

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
