import createJourney from "jerni";
import { makeMongoDBStore } from "@jerni/store-mongodb";
import { BankAccountModel, BankAccountModel_2 } from "../models";
import makeTestLogger from "../makeTestLogger";

function getEventsServerUrl() {
  if (!process.env.EVENTS_SERVER) {
    return "";
  }

  const eventsServerUrl = new URL(process.env.EVENTS_SERVER);
  if (process.env.EVENTS_SERVER_KEY) {
    eventsServerUrl.username = process.env.EVENTS_SERVER_KEY;
  }
  if (process.env.EVENTS_SERVER_SECRET) {
    eventsServerUrl.password = process.env.EVENTS_SERVER_SECRET;
  }

  return eventsServerUrl.toString();
}

const ENV_MONGO = {
  url: process.env.MONGODB_URL || "mongodb://127.0.0.1:27017",
  dbName: process.env.MONGODB_DBNAME || "partners-portal-local",
};

export default async function initializeJourney(mongodb = ENV_MONGO, eventsServer = getEventsServerUrl()) {
  const logger = makeTestLogger();

  const mongoStore = await makeMongoDBStore({
    name: "integration-cli",
    ...mongodb,
    models: [BankAccountModel, BankAccountModel_2],
    logger,
  });

  const journey = createJourney({
    server: eventsServer,
    stores: [mongoStore],
    onError: (error, event) => {},
    onReport: (reportType, reportData) => {},
    logger,
  });

  return journey;
}
