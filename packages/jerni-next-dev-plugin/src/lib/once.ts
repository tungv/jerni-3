// biome-ignore lint/suspicious/noExplicitAny: any function would be fine
type AnyFunction = (...args: any[]) => any;

export default function once<T extends AnyFunction>(fn: T): T {
  let called = false;
  let result: ReturnType<T>;

  return ((...args: Parameters<T>) => {
    if (called) {
      return result;
    }

    called = true;
    result = fn(...args);
    return result;
  }) as T;
}
