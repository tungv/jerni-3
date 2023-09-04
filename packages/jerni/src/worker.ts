interface Job {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export default async function initWorker(filePath: string) {
  console.log(`Starting worker ${filePath}...`);
  const { default: initializer } = await import(filePath);

  console.log("initializer", initializer);

  const journey = await initializer();

  console.log("journey", journey);

  const ctrl = new AbortController();

  const job: Job = {
    async start() {
      for await (const events of journey.begin(ctrl.signal)) {
        console.log("events", events);
      }
    },

    async stop() {
      ctrl.abort();
    },
  };

  return job;
}
