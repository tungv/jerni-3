import makeTestLogger from "./makeTestLogger";
import { JourneyConfig } from "jerni/type";
import createJourney from "jerni";
import { JourneyCommittedEvent } from "@jerni/store-mongodb/lib/src/types";

export default async function initJourney(
  stores: JourneyConfig["stores"],
  serverPort: number,
  onError?: (error: Error, event: JourneyCommittedEvent) => void,
) {
  const logger = makeTestLogger();

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
    },
    logger,
  });

  return {
    journey,
    logger,
  };
}
