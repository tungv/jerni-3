# Commands

## Build & Development
- Build dev tools: `bun run build-dev-tools`
- Run tests: `NODE_ENV=test bun test`
- Run single test: `NODE_ENV=test bun test packages/path/to/file.spec.ts`
- Format code: `bunx @biomejs/biome format --write .`
- Lint code: `bunx @biomejs/biome lint .`
- Organize imports: `bunx @biomejs/biome check --apply-unsafe .`

## Code Style Guidelines

- **Formatting**: 2-space indentation, 120-character line width, LF line endings
- **TypeScript**: Strict typing with noUnusedLocals and noUnusedParameters enabled
- **Imports**: Use ESM imports, organize imports (auto-sorted by Biome)
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **Tests**: Use Bun Test with `expect` assertions
- **Error handling**: Use `UnrecoverableError` for critical failures, proper async/await error handling
- **Architectural pattern**: Event sourcing with MongoDB store integration
- **Code organization**: Modular exports for library components