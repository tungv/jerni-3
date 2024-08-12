// bun server
// this server is a "read-only" version of a events-server
// it will assume it has a 10_000 events of type "Type_A", "Type_B", "Type_C"
// it will repeat in this pattern, A, A, B, B, C, C, C, C, A, A, B, B, ...

function getEventById(id: number) {
  // it will repeat in this pattern, A, A, B, B, C, C, C, C, A, A, B, B, ...
  const A = "Type_A";
  const B = "Type_B";
  const C = "Type_C";

  const type = [A, A, B, B, C, C, C, C][id % 8];
  return {
    id,
    type,
    payload: {
      value: id + 1,
    },
    meta: {},
  };
}

const server = Bun.serve({
  port: 4000,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/events/latest") {
      // return the latest event (id: 10_000)
      const lastEvent = getEventById(10_000);
      console.log("lastEvent", lastEvent);

      return Response.json(lastEvent);
    }

    // 2. GET /subscribe
    if (req.method === "GET" && url.pathname === "/subscribe") {
      const lastEventId = Number(url.searchParams.get("lastEventId")) || 0;
      const events = Array.from({ length: 1000 }, (_, i) => getEventById(lastEventId + i + 1));

      const stream = new ReadableStream({
        async start(controller) {
          // write metadata
          controller.enqueue(":ok\n\n");

          const batch = [];
          for (const event of events) {
            batch.push(event);
            if (batch.length === 10) {
              controller.enqueue(`id: ${event.id}
event: INCMSG
data: ${JSON.stringify(batch)}

`);
              batch.length = 0;

              await Bun.sleep(10);
            }
          }

          // send the last batch
          if (batch.length > 0) {
            controller.enqueue(`id: ${events[events.length - 1].id}
type: INCMSG
data: ${JSON.stringify(batch)}

`);
          }

          // keep the connection open
          while (true) {
            await Bun.sleep(1000);
            controller.enqueue(":\n\n");
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return Response.json(
      {
        message: "not found",
      },
      {
        status: 404,
      },
    );
  },
});
