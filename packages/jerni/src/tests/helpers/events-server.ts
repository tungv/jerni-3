import { Database } from "bun:sqlite";
import { mock } from "bun:test";
import type { JourneyCommittedEvent } from "../../types/events";

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

      // 3. GET /subscribe
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

    // get last event id from req headers
    const lastEventId = req.headers.get("Last-Event-ID");

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
          const lastEventIdNumber = Number.parseInt(lastEventId || "0", 10);

          let lastReturned = lastEventIdNumber;

          // write metadata
          controller.write(":ok\n\n");

          do {
            // query for new events
            const rows = events.filter((event) => event.id > lastReturned);

            // if empty, wait for 1 second
            if (rows.length === 0) {
              await Bun.sleep(subscriptionInterval);
              continue;
            }

            const last = rows[rows.length - 1];
            lastReturned = last.id;

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
