import createJourney from "jerni";

export default async function simpleWorker() {
  console.log("Hello from worker!");

  const journey = await createJourney({
    logger: console,
    stores: [],
    server: {
      url: process.env.EVENTS_SERVER_URL!,
      key: process.env.EVENTS_SERVER_KEY!,
      secret: process.env.EVENTS_SERVER_SECRET!,
    },
    dev: true,
    onError: (error) => {},
    onReport: (report) => {},
  });

  return journey;
}
