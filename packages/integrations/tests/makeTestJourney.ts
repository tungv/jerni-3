import makeTestLogger from "./makeTestLogger";
import { JourneyConfig } from "jerni/type";
import createJourney from "jerni";
import { JourneyCommittedEvent } from "@jerni/store-mongodb/lib/src/types";
import { mock } from "bun:test";

export default async function initJourney(
  stores: JourneyConfig["stores"],
  serverPort: number,
  onError?: (error: Error, event: JourneyCommittedEvent) => void,
) {
  const logger = makeTestLogger();

  const onReport = mock((type: string, payload: any) => {});

  const journey = createJourney({
    server: `http://localhost:${serverPort}`,
    // server,
    stores,
    onError: (error, event) => {
      return onError?.(error, event);
    },
    onReport: (reportType, reportData) => {
      console.info(
        "REPORT :: [%s] | %s",
        reportType,
        JSON.stringify(reportData),
      );

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
