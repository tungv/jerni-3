import type {
  JourneyCommittedEvent,
  LocalEvents,
  ToBeCommittedJourneyEvent,
  TypedJourneyCommittedEvent,
} from "./events";
import type { JourneyInstance } from "./journey";

export interface JourneyTestInstance extends Omit<JourneyInstance, "commit" | "append"> {
  commit<P extends keyof LocalEvents>(event: ToBeCommittedJourneyEvent<P>): Promise<TypedJourneyCommittedEvent<P>>;
  append<P extends keyof LocalEvents>(event: ToBeCommittedJourneyEvent<P>): Promise<TypedJourneyCommittedEvent<P>>;
  waitAll(): Promise<void>;
  committed: JourneyCommittedEvent[];
}
