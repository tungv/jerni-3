# PUBLISHING

1. First, create a new local branch prefixed with `release/` followed by the version you want to publish. E.g. `release/v0.10.4` to publish v0.10.4.
2. Secondly, you need to bump the version in both `jsr.json` and `package.json`. There are scripts to help with this:

   - `bun run bump-patch`: run this to bump the patch version.
   - `bun run bump-minor`: run this to bump the minor version.
   - `bun run bump-major`: run this to bump the major version.

3. Once the version is bumped, create a PR and get it merged. CI/CD will automatically build the package and publish it to JSR.
