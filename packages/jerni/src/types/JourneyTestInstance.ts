import type { JourneyCommittedEvent } from "./events";
import type { JourneyInstance } from "./journey";

export interface JourneyTestInstance extends JourneyInstance {
  waitAll(): Promise<void>;
  committed: JourneyCommittedEvent[];
}
