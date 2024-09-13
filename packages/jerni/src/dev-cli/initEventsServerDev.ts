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
function getEventsFromSqlite(filePath: string, lastId: number) {
  const db = sqlite.open(filePath);

  const events = db
    .prepare<
      SavedEvent,
      {
        $lastId: number;
      }
    >("SELECT * FROM events WHERE id > $lastId ORDER BY id ASC")
    .all({
      $lastId: lastId,
    });

  return events.map((event) => ({
    id: event.id,
    type: event.type as keyof LocalEvents,
    payload: JSON.parse(event.payload),
    meta: JSON.parse(event.meta),
  }));
}

function getLastEvent(filePath: string) {
  const db = sqlite.open(filePath);

  const last = db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT 1").get() as SavedEvent;

  return last;
}

export default async function initEventsServerDev(textFileName: string, sqliteFileName: string, port: number) {
  let server: Server;

  ensureFileExists(textFileName);

  ensureSqliteTable(sqliteFileName);

  return {
    start: async () => {
      server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);

          if (req.method === "GET" && url.pathname === "/events/latest") {
            const lastEvent = getLastEvent(sqliteFileName);

            if (!lastEvent) {
              return Response.json({
                id: 0,
                type: "@@INIT",
                payload: {},
                meta: {},
              });
            }

            const latestEvent = {
              id: lastEvent.id,
              type: lastEvent.type,
              payload: JSON.parse(lastEvent.payload),
              meta: lastEvent.meta ? JSON.parse(lastEvent.meta) : {},
            };

            return Response.json(latestEvent);
          }

          if (req.method === "GET" && url.pathname === "/subscribe") {
            return streamingResponse(req, sqliteFileName);
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

async function streamingResponse(req: Request, sqliteFileName: string) {
  const signal = req.signal;

  const url = new URL(req.url);

  // write headers
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  const lastEventId = url.searchParams.get("lastEventId");

  return new Response(
    new ReadableStream({
      type: "direct",
      async pull(controller) {
        let lastReturnedIndex = lastEventId ? Number.parseInt(lastEventId, 10) : 0;

        // write metadata
        controller.write(":ok\n\n");

        do {
          const rows = getEventsFromSqlite(sqliteFileName, lastReturnedIndex);

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
