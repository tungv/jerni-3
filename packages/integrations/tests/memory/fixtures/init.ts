import { heapStats } from "bun:jsc";
import createJourney from "@jerni/jerni-3";

import { MongoDBModel, makeMongoDBStore, readPipeline } from "@jerni/store-mongodb";
import prettyBytes from "@minikit/pretty-bytes";
import makeTestLogger from "../../makeTestLogger";

export default async function init() {
  const stores = [];
  // duplicate the store 100x
  for (let i = 0; i < 100; i++) {
    const model = new MongoDBModel({
      name: `test_${i}`,
      version: "6",
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
    });
    const store = await makeMongoDBStore({
      name: "test",
      dbName: "memory_leak",
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      url: process.env.MONGODB_URL!,
      models: [model],
      logger: {
        log: console.log,
        debug: console.log,
        error: () => {},
        warn: () => {},
        info: () => {},
      },
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

const id = setInterval(() => {
  console.log("keep alive");
  // const stats = heapStats();
  // console.log(
  //   `heap size: ${prettyBytes(stats.heapCapacity)}, used: ${prettyBytes(stats.heapSize)} | ${(
  //     stats.objectCount / 1000
  //   ).toFixed(2)}k objects`,
  // );
}, 500);