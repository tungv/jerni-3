import createJourney from "jerni";
import { makeMongoDBStore } from "@jerni/store-mongodb";

import { LicenseeModel } from "./licensee";

export default async function initJourney() {
  const mongodbUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
  const mongodbDatabase = process.env.MONGODB_DBNAME || "operator_app_local";

  const store = await makeMongoDBStore({
    name: "operator-app",
    url: mongodbUrl,
    dbName: mongodbDatabase,
    models: [LicenseeModel],
  });

  const journey = createJourney({
    server: {
      key: process.env.EVENTS_SERVER_KEY!,
      secret: process.env.EVENTS_SERVER_SECRET!,
      url: process.env.EVENTS_SERVER_URL!,
    },
    stores: [store],
    onError(err, event) {
      console.error(err, event);
    },
  });

  return journey;
}
