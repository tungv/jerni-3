// debounce function receive a function (called orginal) and a delay, return a new function
// the org function will take T[] as input, and return a value of type R[]
// the new function will take T as input, and return a value of type R
// the new function will call the org function with a list of T, after delay time
// if the new function is called again, the delay time will be reset
// if the new function is not called again, the org function will be called with the last list of T

export default function debounce<T>(original: (args: T[]) => Promise<void>, delay: number) {
  let timeout: Timer;
  const args: T[] = [];

  return (arg: T[]) => {
    args.push(...arg);

    clearTimeout(timeout);

    timeout = setTimeout(async () => {
      // need to create a new array so that the while the org function is called, any changes to args will not be affected
      const newArgs = [...args];
      // also set args to empty array, so that the next call will not be affected by the previous call
      args.length = 0;

      await original(newArgs);
    }, delay);
  };
}
