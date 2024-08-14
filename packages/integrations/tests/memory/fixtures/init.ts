import createJourney from "@jerni/jerni-3";
import { MongoDBModel, makeMongoDBStore, readPipeline } from "@jerni/store-mongodb";

export default async function init() {
  const stores = [];
  for (let i = 0; i < 10; i++) {
    const model = new MongoDBModel({
      name: `test_${i}`,
      version: "1",
      transform(event) {
        // console.log("transforming", event);
        // readPipeline([
        //   {
        //     $match: {
        //       id: { $lte: event.payload.id },
        //     },
        //   },
        // ]);
        return [
          {
            insertOne: {
              document: event.payload,
            },
          },
        ];
      },
      meta: {
        includes: ["Type_A", "Type_B", "Type_C"],
      },
    });
    const store = await makeMongoDBStore({
      name: "test",
      dbName: "memory_leak",
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      url: process.env.MONGODB_URL!,
      models: [model],
      logger,
    });
    stores.push(store);
  }

  const journey = createJourney({
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    server: process.env.EVENTS_SERVER_URL!,
    onError: (err) => {
      console.error(err);
    },
    stores: stores,
    logger: logger,
  });
  console.log("store created");

  return journey;
}

const nolog = () => {};
const log = console.log;
const logger = {
  log: log,
  debug: log,
  info: log,
  warn: log,
  error: log,
};
