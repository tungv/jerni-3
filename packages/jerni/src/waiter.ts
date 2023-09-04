import { EventEmitter } from "events";

/**
 * this will create a waiter that keep track of N tracks
 * each track has function to set the track to a certain number that must be greater than the current number
 *
 * waiter has a function to wait until all tracks have reached a certain number
 *
 * @example
 * ```ts
 * const [increment, wait] = waiter(4);
 *
 * // increment track number 0 to 1
 * increment(0, 1);
 *
 * // increment track number 1 to 2
 * increment(1, 2);
 *
 * // increment track number 2 to 3
 * increment(2, 3);
 *
 * // increment track number 3 to 4
 * increment(3, 4);
 *
 * // wait until all tracks have reached 3
 * wait(3).then(() => console.log("all tracks have reached 3"))
 *
 * // later in code
 * increment(0, 3);
 * increment(1, 4);
 *
 * // console: all tracks have reached 3
 * ```
 */

export interface Increment {
  (track: number, number: number): void;
}

export interface Wait {
  (number: number): Promise<void>;
  (number: number, timeout: number | AbortSignal): Promise<void>;
}

export interface ResetAll {
  (): void;
  (number: number): void; // reset all tracks to a certain number
}

export default function createWaiter(
  trackCount: number,
  initialNumber: number = 0,
): {
  increment: Increment;
  wait: Wait;
  resetAll: ResetAll;
} {
  const slots = new Array(trackCount).fill(initialNumber);

  const emitter = new EventEmitter();

  function isAllReached(number: number) {
    return slots.every((slot) => slot >= number);
  }

  function increment(index: number, value: number) {
    const current = slots[index];
    if (value <= current) {
      // do nothing
      return;
    }

    slots[index] = value;
    emitter.emit("increment", value);
  }

  async function wait(number: number, abortOrTimeout?: number | AbortSignal) {
    if (abortOrTimeout) {
      if (typeof abortOrTimeout === "number") {
        return waitUntilDeadline(number, Date.now() + abortOrTimeout);
      }

      return waitUntilAborted(number, abortOrTimeout);
    }

    const [value] = (await EventEmitter.once(emitter, "increment")) as [number];
    if (value >= number) {
      return wait(number);
    }
  }

  async function waitUntilDeadline(number: number, deadline: number) {
    if (isAllReached(number)) {
      return;
    }

    if (Date.now() > deadline) {
      throw new Error("waiter timeout");
    }

    const [value] = (await EventEmitter.once(emitter, "increment")) as [number];
    if (value >= number) {
      return waitUntilDeadline(number, deadline);
    }
  }

  async function waitUntilAborted(number: number, signal: AbortSignal) {
    if (isAllReached(number)) {
      return;
    }

    if (signal.aborted) {
      throw new Error("waiter aborted");
    }

    const [value] = (await EventEmitter.once(emitter, "increment")) as [number];
    if (value >= number) {
      return waitUntilAborted(number, signal);
    }
  }

  function resetAll(value: number = initialNumber) {
    if (value <= initialNumber) {
      return;
    }

    const currentMin = Math.min(...slots);
    if (currentMin >= value) {
      return;
    }

    emitter.emit("increment", value);

    for (let i = 0; i < slots.length; i++) {
      // if current slot is greater than value, do nothing
      slots[i] = Math.max(slots[i], value);
    }
  }

  return {
    increment,
    wait,
    resetAll,
  };
}
