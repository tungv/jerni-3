import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";
import prettyBytes from "@minikit/pretty-bytes";
import { $ } from "bun";
import pidusage from "pidusage";
import createServer from "./helpers/server";

declare module "@jerni/jerni-3/types" {
  interface SubscribingEventDefinitions {
    Test: {
      key: number;
    };
  }
}

describe("memory leak", () => {
  let child: ReturnType<typeof Bun.spawn>;

  afterEach(() => {
    if (child) {
      console.log("killing child");
      child.kill();
    }
  });

  test("memory leak", async () => {
    // run the test in bun
    const pathToSrc = path.resolve(import.meta.dir, "./fixtures/start.ts");
    const pathToBin = `${import.meta.dir}/cli`;

    // build the fixture
    await $`bun build --compile ${pathToSrc} --outfile ${pathToBin}`;

    // clean mongodb db before the test
    await $`mongosh mongodb://localhost:27017/memory_leak --eval "db.dropDatabase()"`;

    using mock = createServer(
      Array.from({ length: 1000 }).map((_, i) => ({
        id: i + 1,
        type: "Test",
        payload: {
          key: i + 1,
        },
      })),
    );

    const url = mock.server.url.toString();

    child = Bun.spawn(["bun", pathToSrc], {
      env: {
        MONGODB_URL: "mongodb://localhost:27017",
        EVENTS_SERVER_URL: url,
      },
    });

    // print stdout
    const { body } = new Response(child.stdout);

    if (body) {
      // log asynchronously

      (async () => {
        for await (const chunk of body) {
          // convert to utf-8 string
          console.log(">>>", new TextDecoder().decode(chunk));
        }
      })();
    }

    await Bun.sleep(5000);

    // for every 5 seconds, we will check the heap snapshot
    let counter = 0;
    let last = 0;
    let initial = 0;

    const memStats = {
      cycles: 0,
      increasing: 0,
      decreasing: 0,
      unchanged: 0,
    };

    do {
      await Bun.sleep(1000);
      counter++;
      memStats.cycles++;
      if (child.killed) {
        console.log("process is killed");
        return;
      }

      try {
        const stats = await pidusage(child.pid);
        const now = stats.memory;

        if (last === 0) {
          console.log("initial memory:", prettyBytes(now));
          initial = now;
          last = now;
        }

        if (last === now) {
          memStats.unchanged++;
          console.log(`[${String(counter).padStart(5, "0")}] ...`);
          continue;
        }

        if (now - last > 0) {
          memStats.increasing++;
          console.log(
            `[${String(counter).padStart(5, "0")}] memory + ${prettyBytes(now - last)} | total: BASE + ${prettyBytes(
              now - initial,
            )}`,
          );
        } else {
          memStats.decreasing++;
          console.log(
            `[${String(counter).padStart(5, "0")}] memory - ${prettyBytes(last - now)} | total: BASE + ${prettyBytes(
              now - initial,
            )}`,
          );
        }

        console.log(
          `[${String(counter).padStart(5, "0")}] cycles: ${memStats.cycles}, increasing: ${
            memStats.increasing
          }, decreasing: ${memStats.decreasing}, unchanged: ${memStats.unchanged}`,
        );

        // update last
        last = now;
      } catch (ex) {
        console.log("process is killed", ex);
        return;
      }
    } while (counter < 1000000);
  });
});
