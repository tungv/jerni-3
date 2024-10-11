import type { JourneyCommittedEvent } from "./types/events";

export default class JerniPersistenceError extends Error {
  // @ts-ignore
  #event: JourneyCommittedEvent;
  // @ts-ignore
  #elapsed: number;

  constructor(event: JourneyCommittedEvent, elapsed: number) {
    super(`event ${event.id} is not ready in ${elapsed} ms`);
    this.#event = event;
    this.#elapsed = elapsed;
  }
}
