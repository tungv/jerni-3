import makeTestLogger from "./makeTestLogger";
import { JourneyConfig } from "jerni/type";
import createJourney from "jerni";

export default async function initJourney(
  dbName: string,
  stores: JourneyConfig["stores"],
  serverPort: number,
) {
  const logger = makeTestLogger();

  const journey = createJourney({
    server: `http://localhost:${serverPort}`,
    // server,
    stores,
    onError: (error) => {
      logger.error(error);
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
