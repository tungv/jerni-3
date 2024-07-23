import fs from "node:fs";
import type { Server } from "bun";
import hash_sum from "hash-sum";
import { overEvery } from "lodash/fp";
import yaml from "yaml";
import type { JourneyCommittedEvent } from "../types/events";

export default async function startEventsServerDev(inputFileName: string, port: number) {
  let server: Server;

  return {
    start: async () => {
      const events = readFile(inputFileName);

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
              id: latest.id,
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

            const events = Array.isArray(event) ? event : [event];

            appendEventToFile(inputFileName, events);

            const latest = events[events.length - 1];

            return Response.json(latest, { status: 201 });
          }

          return new Response("not_found", {
            status: 404,
          });
        },
      });
    },
    stop: async () => {
      console.log("shutting down event server");
      server.stop();
    },
  };
}

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

  function injectId(event: JourneyCommittedEvent, index: number) {
    return {
      ...event,
      id: index + 1,
    };
  }

  const effectiveEvents = events.filter((e) => isEffectiveEvent(e)).map(injectId);

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

          console.log("returning", rows);

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

type SavedData = {
  checksum: string;

  events: JourneyCommittedEvent[];
};

function readFile(filePath: string) {
  // check if file exists
  if (!fs.existsSync(filePath)) {
    // if not, create a new file
    // the first line is checksum: $hash of the content

    const content = {
      checksum: "",
      events: [],
    };

    const stringifiedContent = yaml.stringify(content);
    fs.writeFileSync(filePath, stringifiedContent);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedContent = yaml.parse(fileContent) as SavedData;

  return parsedContent.events;
}

function appendEventToFile(filePath: string, events: JourneyCommittedEvent[]) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedContent = yaml.parse(fileContent) as SavedData;

  parsedContent.events.push(...events);

  const newHash = hash_sum(parsedContent);
  parsedContent.checksum = newHash;

  const stringifiedContent = yaml.stringify(parsedContent);

  fs.writeFileSync(filePath, stringifiedContent);
}
