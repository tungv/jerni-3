import { mock } from "bun:test";
import type { JourneyCommittedEvent } from "../../types/events";
import { URL } from "node:url";
import { overEvery } from "lodash/fp";

export default function createServer(events: JourneyCommittedEvent[], subscriptionInterval = 300) {
  const subscriptionInputSpy = mock((searchParams: string, req: Request) => {});

  const server = Bun.serve({
    async fetch(req) {
      /** we need to handle 4 cases:
       * 1. GET /events/latest
       * 2. POST /commit
       * 3. GET /subscribe
       * 4. GET /query
       **/

      const url = new URL(req.url);

      // 1. GET /events/latest
      if (req.method === "GET" && url.pathname === "/events/latest") {
        if (events.length === 0) {
          return Response.json({
            id: 0,
            type: "@@INIT",
            payload: {},
            meta: {},
          });
        }

        return Response.json(events[events.length - 1]);
      }

      // 2. GET /subscribe
      if (req.method === "GET" && url.pathname === "/subscribe") {
        subscriptionInputSpy(url.searchParams.toString(), req);

        return streamingResponse(req, events);
      }

      return new Response("404");
    },
    port: Math.floor(Math.random() * 10000) + 30000,
  });

  return {
    server,
    inputSpies: {
      subscriptionInputSpy,
    },
  };

  async function streamingResponse(req: Request, events: JourneyCommittedEvent[]) {
    const signal = req.signal;

    const url = new URL(req.url);

    // get last event id from req headers
    const lastEventId = url.searchParams.get("lastEventId");
    function largerThanLastEventId(event: JourneyCommittedEvent) {
      return event.id > Number.parseInt(lastEventId || "0", 10);
    }

    const includes = url.searchParams.get("includes");
    const includeList = includes ? includes.split(",") : [];
    function isInIncludeList(event: JourneyCommittedEvent) {
      if (includeList.length === 0) {
        return true;
      }

      return includeList.includes(event.type as string);
    }

    const isEffectiveEvent = overEvery([isInIncludeList, largerThanLastEventId]);

    const effectiveEvents = events.filter((e) => isEffectiveEvent(e));

    // write headers
    const headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    return new Response(
      new ReadableStream({
        type: "direct",
        async pull(controller) {
          let lastReturnedIndex = 0;

          // write metadata
          controller.write(":ok\n\n");

          do {
            // get a batch of events to send
            const batch = effectiveEvents.slice(lastReturnedIndex, lastReturnedIndex + 10);

            // update lastReturned to mark the first event for the next batch
            lastReturnedIndex += batch.length;

            // if empty, wait for 1 second
            if (batch.length === 0) {
              await Bun.sleep(subscriptionInterval);
              continue;
            }

            // only include events that are in the include list
            const rows = batch.filter(isInIncludeList);

            const last = rows[rows.length - 1];

            // check if client is still connected
            if (signal.aborted) {
              return controller.close();
            }

            // flush to client
            controller.write(`id: ${last.id}\nevent: INCMSG\ndata: ${JSON.stringify(rows)}\n\n`);

            // flush immediately
            controller.flush();

            // sleep for 1 second
            // await Bun.sleep(subscriptionInterval);
          } while (!signal.aborted);
        },
      }),
      { status: 200, headers },
    );
  }
}
