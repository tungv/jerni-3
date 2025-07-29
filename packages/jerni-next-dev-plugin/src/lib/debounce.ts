// biome-ignore lint/suspicious/noExplicitAny: just a placeholder for the function type
type AnyFunction = (...args: any[]) => void;

export default function debounce<T extends AnyFunction>(fn: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => fn(...args), wait);
  };
}
