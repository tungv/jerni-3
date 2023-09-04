import { Database } from "bun:sqlite";
import { JourneyCommittedEvent, JourneyEvent } from "jerni/type";

export default function createServer(subscriptionInterval: number = 300) {
  const db = createDb();

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
        const latest = db
          .query<JourneyCommittedEvent, []>(
            "SELECT * FROM events ORDER BY id DESC LIMIT 1",
          )
          .get();

        if (!latest) {
          return Response.json({
            id: 0,
            type: "@@INIT",
            payload: {},
            meta: {},
          });
        }

        const latestEvent: JourneyCommittedEvent = {
          id: latest.id,
          type: latest.type,
          payload: JSON.parse(latest.payload),
          meta: JSON.parse(latest.meta),
        };

        return Response.json(latestEvent);
      }

      // 2. POST /commit
      if (req.method === "POST" && url.pathname === "/commit") {
        const event = (await req.json()) as JourneyEvent | JourneyEvent[];

        const events = Array.isArray(event) ? event : [event];

        const stmt = db.prepare(
          "INSERT INTO events (type, payload, meta) VALUES ($1, $2, $3);",
        );

        db.transaction(() => {
          for (const event of events) {
            stmt.run(
              event.type,
              JSON.stringify(event.payload),
              JSON.stringify(event.meta),
            );
          }
        })();

        const latest = db
          .query<{ id: number }, []>(
            "SELECT id FROM events ORDER BY id DESC LIMIT 1",
          )
          .get();

        const eventsWithId = events.map((event, index) => ({
          id: latest!.id - events.length + index + 1,
          ...event,
        }));

        const res = Array.isArray(event) ? eventsWithId : eventsWithId[0];

        return Response.json(res, { status: 201 });
      }

      // 3. GET /subscribe
      if (req.method === "GET" && url.pathname === "/subscribe") {
        return streamingResponse(req);
      }

      return new Response("404");
    },
  });

  return server;

  async function streamingResponse(req: Request) {
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
          const lastEventIdNumber = parseInt(lastEventId || "0", 10);
          const query = db.query<JourneyCommittedEvent, [number]>(
            "SELECT * FROM events WHERE id > ?",
          );

          let lastReturned = lastEventIdNumber;

          // write metadata
          controller.write(":ok\n\n");

          do {
            // query for new events
            const rows = query.all(lastReturned);

            // if empty, wait for 1 second
            if (rows.length === 0) {
              await Bun.sleep(subscriptionInterval);
              continue;
            }

            const events = rows.map((row) => ({
              id: row.id,
              type: row.type,
              payload: JSON.parse(row.payload),
              meta: JSON.parse(row.meta),
            }));

            const last = rows[rows.length - 1];
            lastReturned = last.id;

            // check if client is still connected
            if (signal.aborted) {
              return controller.close();
            }

            // flush to client
            controller.write(
              `id: ${last.id}\nevent: INCMSG\ndata: ${JSON.stringify(
                events,
              )}\n\n`,
            );

            // flush immediately
            controller.flush();

            // sleep for 1 second
            await Bun.sleep(subscriptionInterval);
          } while (!signal.aborted);
        },
      }),
      { status: 200, headers },
    );
  }
}

function createDb() {
  const db = new Database(":memory:");

  db.query(
    `CREATE TABLE
  events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    payload TEXT,
    meta TEXT
  )
`,
  ).run();
  return db;
}
