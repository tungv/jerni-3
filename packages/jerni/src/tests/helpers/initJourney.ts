import { mock } from "bun:test";
import createJourney from "src/createJourney";
import type { JourneyConfig } from "../../types/config";

export async function initJourney(eventServerUrl: string, stores: JourneyConfig["stores"]) {
  const logger = makeTestLogger();

  const onReport = mock((type: string, payload: unknown) => {});

  const journey = createJourney({
    server: eventServerUrl,
    // server,
    stores,
    onError: () => {},
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
function makeTestLogger() {
  const logs: string[][] = [];
  return {
    debug: (...msg: string[]) => {
      // logs.push(msg);
    },
    log: (...msg: string[]) => {
      logs.push(msg);
    },
    warn: (...msg: string[]) => {
      logs.push(msg);
    },
    info: (...msg: string[]) => {
      logs.push(msg);
    },
    error: (...msg: string[]) => {
      logs.push(msg);
    },
    logs,
  };
}
