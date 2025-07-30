# jerni-next-dev-plugin

A Webpack plugin for Next.js projects to enable Jerni development mode.

This plugin swaps [jerni-3](https://github.com/tungv/jerni-3) in dev mode with a bundled version for faster development.

## Installation

// TODO

## Usage

1. Create a `next.config.mjs` file in your project root (if you don't already have one).

2. Import the `withJerniNextDev` function from `jerni-next-dev-plugin` and wrap your Next.js config with it:

```js
// next.config.mjs
import withJerniNextDev from "jerni-next-dev-plugin";
const nextConfig = {
  // Your existing Next.js config...
};
export default withJerniNextDev(nextConfig, {
  initializerPath: "./path/to/your/jerni/initializer",
  eventsFile: "./path/to/your/events.yaml",
});
```

3. The plugin will automatically enable Jerni development mode in your Next.js development server.

## Configuration

The `withJerniNextDev` function accepts two arguments:

- `nextConfig`: Your existing Next.js configuration object.
- `options`: An object with the following properties:
  - `initializerPath`: The path to your Jerni initializer file.
  - `eventsFile`: The path to your Jerni events markdown file.

## How It Works

The `jerni-next-dev-plugin` does the following:

- Aliases the `@jerni/jerni-3` package to use the development version bundled with this plugin.
- Defines global variables for the paths to your Jerni events file and SQLite database.
- Applies a custom webpack plugin to enable hot reloading of Jerni when the initializer or events file changes.
- Automatically cleans and restarts Jerni when necessary to keep it in sync with your code changes.

## Locking Mechanisms

This plugin implements two types of locking mechanisms to ensure thread safety and prevent race conditions during development:

### Global Lock (`global-lock.ts`)

The `GlobalJerniDevLock` class provides an exclusive lock implementation with the following methods:

#### Methods:

- **`runExclusive<T>(fn: () => Promise<T> | T): Promise<T>`** - Executes a function with exclusive access, blocking all other operations
- **`waitForUnlock(): Promise<void>`** - Waits until exclusive access is available without executing any function

#### Usage in Functions:

**Functions using `runExclusive()`:**

- `flushEvents` in `scheduleCommit.ts` - Ensures exclusive access when writing events to markdown file
- `commit` function in journey instance - Ensures exclusive access when committing events

**Functions using `waitForUnlock()`:**

- `waitFor` function in journey instance - Waits for exclusive access before waiting for specific events
- `getReader` function in journey instance - Waits for exclusive access before providing store readers

### File Lock (`file-lock.ts`)

The file locking system provides read/write locks specifically for file operations:

#### Methods:

- **`withReadLock<T>(fn: () => Promise<T>, fnName: string): Promise<T>`** - Executes a function with read access to files, preventing concurrent writes but allowing concurrent reads
- **`withWriteLock<T>(fn: () => Promise<T>, fnName: string): Promise<T>`** - Executes a function with exclusive write access to files, blocking all other file operations

#### Usage in Functions:

**Functions using `withReadLock()`:**

- `readEventsFromMarkdown(filePath: string)` - Safely reads events from markdown files without blocking other readers

**Functions using `withWriteLock()`:**

- `appendEventsToMarkdown(filePath: string, events: ToBeCommittedJourneyEvent[])` - Exclusively writes new events to markdown files
- `rewriteChecksum(filePath: string)` - Exclusively updates checksums in markdown files

### Lock Coordination

The locking mechanisms work together to ensure:

1. **File consistency** - File locks prevent corruption during concurrent file operations
2. **Operation ordering** - Global locks ensure proper sequencing of Jerni operations
3. **Clean start coordination** - Exclusive locks coordinate clean start operations with normal operations
4. **Development safety** - Prevents race conditions during hot reloading and file watching
