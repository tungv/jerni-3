import MyEventSource from "./MyEventSource";

export default async function* listen(e: MyEventSource, eventName: string) {
  const data: any[] = [];

  const listener = (event: MessageEvent) => {
    data.push(event.data);
  };

  e.addEventListener(eventName, listener);

  try {
    while (true) {
      if (data.length > 0) {
        yield data.shift();
      } else {
        await new Promise((resolve) => e.addEventListener(eventName, resolve));
      }
    }
  } finally {
    e.removeEventListener(eventName, listener);
  }
}
