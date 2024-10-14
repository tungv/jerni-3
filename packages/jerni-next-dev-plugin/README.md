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
