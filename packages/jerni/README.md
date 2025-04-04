# Jerni

Event sourcing library for JavaScript/TypeScript applications.

## Installation

```bash
# From JSR (recommended)
bunx jsr add @jerni/jerni-3

# From npm
npm install @jerni/jerni-3
```

## Usage

```typescript
import { createJourney } from '@jerni/jerni-3';

// Create a journey with MongoDB store
const journey = createJourney({
  // Configuration options...
});

// Start the journey
await journey.start();

// Subscribe to events
journey.subscribe(async (event) => {
  // Handle events
});

// Clean up
await journey.stop();
```

## CLI Usage

The package includes a CLI tool for running jerni:

```bash
# If installed from npm
npx jerni <journey-file>

# If installed from JSR, use the binary download flow
bunx jsr-exec @jerni/jerni-3 start-jerni <journey-file>
```

## PUBLISHING

1. First, create a new local branch prefixed with `release/` followed by the version you want to publish. E.g. `release/v0.10.4` to publish v0.10.4.
2. Secondly, you need to bump the version in both `jsr.json` and `package.json`. There are scripts to help with this:

   - `bun run bump-patch`: run this to bump the patch version.
   - `bun run bump-minor`: run this to bump the minor version.
   - `bun run bump-major`: run this to bump the major version.

3. Once the version is bumped, create a PR and get it merged. CI/CD will automatically build the package and publish it to both JSR and npm.

## License

MIT
