import lodashFlow from "lodash/flow";
import { AsyncLocalStorage } from "node:async_hooks";

interface Inject<T> {
  // biome-ignore lint/suspicious/noExplicitAny: the type of the arguments are not important, just make sure the returned function has the same type
  <C extends (...args: any) => any>(value: T, computation: C): C;
  // biome-ignore lint/suspicious/noExplicitAny: the type of the arguments are not important, just make sure the returned function has the same type
  <C extends (...args: any) => any>(computation: C): C;
}

interface AsyncLocal<T> {
  inject: Inject<T>;
  get(): NonNullable<T>;
  start(value: T): void;
  end(): void;
}

export default function setup<T>(initializer: () => Promise<T>): AsyncLocal<T> {
  const storage = new AsyncLocalStorage<T>();

  return {
    // biome-ignore lint/suspicious/noExplicitAny: this is just an internal function, doing type checking is unnecessary
    inject(...args: any[]) {
      if (args.length === 2) {
        const [value, computation] = args;
        return (...computationArgs) => storage.run(value, () => computation(...computationArgs));
      }

      const [computation] = args;
      return async (...computationArgs) => {
        const stored = storage.getStore();

        if (stored) return computation(...computationArgs);

        const value = await initializer();
        return storage.run(value, () => computation(...computationArgs));
      };
    },

    get() {
      const v = storage.getStore();
      if (!v) throw new Error("No value injected");
      return v;
    },

    async start(value?: T) {
      if (value !== undefined) {
        storage.enterWith(value);
        return;
      }

      const stored = storage.getStore();
      if (stored) return;

      const initialValue = await initializer();
      storage.enterWith(initialValue);
    },

    end() {
      storage.disable();
    },
  };
}

export function flow(...injectors: Inject<unknown>[]): Inject<unknown> {
  return lodashFlow(...injectors);
}
