import type { Server } from "bun";
import { last, overEvery } from "lodash/fp";
import type { JourneyCommittedEvent } from "../types/events";
import appendEventsToFile from "./appendEventsToFile";
import readFile from "./readFile";

export default async function initEventsServerDev(inputFileName: string, port: number) {
  let server: Server;

  return {
    start: async () => {
      const { events } = readFile(inputFileName);

      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          if (req.method === "GET" && url.pathname === "/events/latest") {
            if (events.length === 0) {
              return Response.json({
                id: 0,
                type: "@@INIT",
                payload: {},
                meta: {},
              });
            }

            const latest = events[events.length - 1];

            if (!latest) {
              return Response.json({
                id: 0,
                type: "@@INIT",
                payload: {},
                meta: {},
              });
            }

            const latestEvent = {
              id: events.length,
              type: latest.type,
              payload: latest.payload,
              meta: latest.meta || {},
            };

            return Response.json(latestEvent);
          }

          if (req.method === "GET" && url.pathname === "/subscribe") {
            return streamingResponse(req, events);
          }

          if (req.method === "POST" && url.pathname === "/commit") {
            const event = (await req.json()) as JourneyCommittedEvent | JourneyCommittedEvent[];

            const newEvents = Array.isArray(event) ? event : [event];

            const latestId = appendEventsToFile(inputFileName, newEvents);

            const latest = last(newEvents);

            return Response.json(
              {
                ...latest,
                id: latestId,
              },
              { status: 201 },
            );
          }

          return new Response("not_found", {
            status: 404,
          });
        },
      });
    },
    stop: async () => {
      console.log("shutting down event server");
      server?.stop();
    },
  };
}

async function streamingResponse(req: Request, events: JourneyCommittedEvent[]) {
  const signal = req.signal;

  function injectId(event: JourneyCommittedEvent, index: number) {
    return {
      ...event,
      id: index + 1,
    };
  }

  const effectiveEvents = events.map(injectId);

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
          const rows = effectiveEvents.slice(lastReturnedIndex, lastReturnedIndex + 10);

          // update lastReturned to mark the first event for the next batch
          lastReturnedIndex += rows.length;

          // if empty, wait for 1 second
          if (rows.length === 0) {
            await Bun.sleep(300);
            continue;
          }

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
