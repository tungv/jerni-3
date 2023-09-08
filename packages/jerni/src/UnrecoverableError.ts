import { JourneyCommittedEvent } from "./types/events";

export default class UnrecoverableError extends Error {
  #event: JourneyCommittedEvent;

  constructor(offendingEvent: JourneyCommittedEvent) {
    super(`UnrecoverableError: ${offendingEvent.type}#${offendingEvent.id}`);
    this.name = "UnrecoverableError";
    this.#event = offendingEvent;
  }
}
