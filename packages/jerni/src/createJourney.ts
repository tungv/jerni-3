import { getEventSource } from "./getEventSource";
import { JourneyConfig } from "./types/config";
import {
  JourneyCommittedEvent,
  TypedJourneyCommittedEvent,
  TypedJourneyEvent,
} from "./types/events";
import { JourneyInstance } from "./types/journey";
import createWaiter from "./waiter";
import normalizeUrl from "./lib/normalize-url";
import commitToServer from "./lib/commit";

const MyEventSource = getEventSource();

export default function createJourney(config: JourneyConfig): JourneyInstance {
  let serverLatest = 0;
  let clientLatest = 0;

  let hasStartedWaiting = false;

  const modelToStoreMap = new Map<any, JourneyConfig["stores"][number]>();

  const { logger, onReport, onError } = config;
  const { url, logSafeUrl } = normalizeUrl(config);

  onReport("server_url_resolved", {
    url: logSafeUrl.toString(),
  });

  logger.debug("[JERNI | DBG] using server url: %s", logSafeUrl.toString());

  // loop through all stores and map them to their models
  logger.debug("[JERNI | DBG] registering models...");
  for (const store of config.stores) {
    store.registerModels(modelToStoreMap);
  }

  const waiter = createWaiter(config.stores.length);

  return {
    async commit<T extends string>(
      uncommittedEvent: TypedJourneyEvent<T>,
    ): Promise<TypedJourneyCommittedEvent<T>> {
      return commitToServer(
        logger,
        url,
        logSafeUrl,
        onReport,
        onError,
        uncommittedEvent,
      );
    },
    async waitFor(
      event: Pick<JourneyCommittedEvent, "id" | "meta">,
      timeoutOrSignal?: number | AbortSignal,
    ) {
      logger.debug("waiting for event", event.id);

      if (!hasStartedWaiting) {
        hasStartedWaiting = true;

        for (
          let storeIndex = 0;
          storeIndex < config.stores.length;
          storeIndex++
        ) {
          const store = config.stores[storeIndex];

          (async () => {
            for await (const checkpoint of store.listen()) {
              waiter.increment(storeIndex, checkpoint);
            }
          })();
        }
      }

      const { id } = event;
      if (timeoutOrSignal) {
        await waiter.wait(id, timeoutOrSignal);
      } else {
        await waiter.wait(id, 3_000);
      }

      logger.debug("event", event.id, "is ready");

      if (event.meta?.committed_at) {
        const waited = Date.now();
        const turnaround = waited - event.meta.committed_at;
        logger.debug("event", event.id, "is ready in", turnaround, "ms");
        onReport("event_ready", {
          event_id: event.id,
          turnaround,
        });
      }
    },
    async getReader(model: any) {
      const store = modelToStoreMap.get(model);

      if (!store) {
        throw new Error("model is not registered");
      }

      return store.getDriver(model);
    },
    dispose: async () => {},

    async *begin() {
      const ctrl = new AbortController();

      logger.debug("[JERNI | INF] Starting journey...");

      // $SERVER/subscribe
      const subscriptionUrl = new URL("subscribe", url);
      // $SERVER/events/latest
      const getLatestUrl = new URL("events/latest", url);

      const response = await fetch(getLatestUrl.toString(), {
        headers: {
          "content-type": "application/json",
        },
      });
      const latestEvent: JourneyCommittedEvent<any, any> =
        await response.json();

      serverLatest = latestEvent.id;

      logger.debug("server latest event id:", serverLatest);
      logger.debug("client latest event id:", clientLatest);

      if (serverLatest > clientLatest) {
        logger.debug("catching up...");
      }

      subscriptionUrl.searchParams.set("lastEventId", clientLatest.toString());
      const ev = new MyEventSource(subscriptionUrl.toString());

      ev.addEventListener("open", (event) => {
        logger.info("start receiving data");
      });

      ev.addEventListener("START", (event) => {
        logger.debug("event", event.data);
      });

      ev.addEventListener("INCMSG", (event) => {
        const data = JSON.parse(event.data) as JourneyCommittedEvent[];
        logger.debug("received events", data);
        const output = config.stores.map((store) => store.handleEvents(data));
        console.info("output", output);
      });

      ev.addEventListener("error", (event) => {
        logger.error(event as ErrorEvent);

        ev.close();
      });

      return;
    },
  };
}
