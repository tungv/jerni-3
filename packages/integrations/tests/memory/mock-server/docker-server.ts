// bun server
// this server is a "read-only" version of a events-server
// it will assume it has a 10_000 events of type "Type_A", "Type_B", "Type_C"
// it will repeat in this pattern, A, A, B, B, C, C, C, C, A, A, B, B, ...

const MAX_EVENTS = 10_000;
const PULSE_COUNT = 200;
const PULSE_TIME = 10;

// it will repeat in this pattern, A, A, B, B, C, C, C, C, A, A, B, B, ...
const A = "Type_A";
const B = "Type_B";
const C = "Type_C";

// a bunch of large size texts
const texts = [
  "Ullam ut quaerat alias repellendus veniam minima nihil necessitatibus. Facilis ex recusandae nobis aliquid neque. Alias animi iure illo incidunt ratione ea libero ex. Eum facere atque debitis aperiam deserunt. Ea ex nobis expedita nisi ullam temporibus explicabo.".repeat(
    20,
  ),

  "Molestiae aliquam molestiae pariatur repellat ducimus adipisci. Quos dolorem tempora itaque eveniet mollitia dolor corporis quos neque. Rerum labore aut porro sequi. Nam occaecati deleniti totam. Atque culpa aperiam at ex. Unde dolorum nobis.".repeat(
    20,
  ),
  "Accusamus quisquam cum ipsa repellendus nisi. Explicabo quisquam occaecati. Quis cumque autem facere doloremque doloribus id mollitia possimus delectus.".repeat(
    20,
  ),
];

function getEventById(id: number) {
  const type = [A, A, B, B, C, C, C, C][id % 8];
  const payload = [texts[0], texts[1], texts[2]][id % 3];
  return {
    id,
    type,
    payload: {
      value: id,
    },
    meta: {},
  };
}

const server = Bun.serve({
  port: 4000,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/events/latest") {
      const lastEvent = getEventById(MAX_EVENTS);
      console.log("lastEvent", lastEvent);

      return Response.json(lastEvent);
    }

    // 2. GET /subscribe
    if (req.method === "GET" && url.pathname === "/subscribe") {
      // get last event id from headers
      const lastEventIdHeader = req.headers.get("Last-Event-ID");
      console.log("new connection", lastEventIdHeader);
      const lastEventId = Number(lastEventIdHeader) || 0;
      let current = lastEventId;

      let cancelled = false;
      req.signal.addEventListener(
        "abort",
        () => {
          console.log("connection aborted");
          cancelled = true;
        },
        { once: true },
      );

      const stream = new ReadableStream({
        async start(controller) {
          // write metadata
          controller.enqueue(":ok\n\n");

          const batch = [];
          while (++current <= MAX_EVENTS) {
            if (cancelled) {
              return;
            }
            batch.push(getEventById(current));

            if (batch.length === PULSE_COUNT) {
              controller.enqueue(`id: ${current}
event: INCMSG
data: ${JSON.stringify(batch)}

`);
              batch.length = 0;

              // console.log("sent batch", current);

              await Bun.sleep(PULSE_TIME);
            }
          }

          // send the last batch
          const lastEvent = batch.at(-1);
          if (lastEvent) {
            controller.enqueue(`id: ${lastEvent.id}
event: INCMSG
data: ${JSON.stringify(batch)}

`);
            // console.log("sent batch", lastEvent.id);
          }

          // keep the connection open
          while (!cancelled) {
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
