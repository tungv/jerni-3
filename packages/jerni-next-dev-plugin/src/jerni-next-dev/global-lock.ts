import { Mutex, withTimeout } from "async-mutex";

export const globalJerniDevLock = withTimeout(new Mutex(), 10_000);
