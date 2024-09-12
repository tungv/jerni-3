import sqlite from "bun:sqlite";
import type { Server } from "bun";
import type { JourneyCommittedEvent, LocalEvents } from "../types/events";
import commitEvent from "./commitEvent";
import ensureFileExists from "./ensureFileExists";
import ensureSqliteTable from "./ensureSqliteTable";

interface SavedEvent {
  id: number;
  type: string;
  payload: string;
  meta: string;
}
function getEventsFromSqlite(filePath: string) {
  const db = sqlite.open(filePath);

  const events = db.prepare<SavedEvent, null>("SELECT * FROM events").all(null);

  return events.map((event) => ({
    id: event.id,
    type: event.type as keyof LocalEvents,
    payload: JSON.parse(event.payload),
    meta: JSON.parse(event.meta),
  }));
}

export default async function initEventsServerDev(textFileName: string, sqliteFileName: string, port: number) {
  let server: Server;

  return {
    start: async () => {
      ensureFileExists(textFileName);

      ensureSqliteTable(sqliteFileName);

      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          if (req.method === "GET" && url.pathname === "/events/latest") {
            const events = getEventsFromSqlite(sqliteFileName);

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
            const events = getEventsFromSqlite(sqliteFileName);

            return streamingResponse(req, events);
          }

          if (req.method === "POST" && url.pathname === "/commit") {
            const event = (await req.json()) as JourneyCommittedEvent | JourneyCommittedEvent[];

            const newEvents = Array.isArray(event) ? event : [event];

            // const latestId = appendEventsToFile(textFileName, newEvents);
            const latestId = commitEvent(sqliteFileName, textFileName, newEvents);

            const latest = newEvents.at(-1);

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
