# isolate jerni so that all the dependencies are installed in the build director
cp -r packages/jerni build

# install the dependencies
cd build
bun install

bun build ./src/cli.ts --compile --smol --target=bun-linux-x64 --outfile ./src/jerni-linux-x64
bun build ./src/cli.ts --compile --smol --target=bun-darwin-x64 --outfile ./src/jerni-darwin-x64
bun build ./src/cli.ts --compile --smol --target=bun-windows-x64 --outfile ./src/jerni-win-x64
bun build ./src/cli.ts --compile --smol --target=bun-linux-arm64 --outfile ./src/jerni-linux-arm64
bun build ./src/cli.ts --compile --smol --target=bun-darwin-arm64 --outfile ./src/jerni-darwin-arm64

# build cli for dev
bun build ./src/dev-cli/index.ts --compile --target=bun-linux-x64 --outfile ./src/jerni-dev-linux-x64
bun build ./src/dev-cli/index.ts --compile --target=bun-darwin-x64 --outfile ./src/jerni-dev-darwin-x64
bun build ./src/dev-cli/index.ts --compile --target=bun-windows-x64 --outfile ./src/jerni-dev-win-x64
bun build ./src/dev-cli/index.ts --compile --target=bun-linux-arm64 --outfile ./src/jerni-dev-linux-arm64
bun build ./src/dev-cli/index.ts --compile --target=bun-darwin-arm64 --outfile ./src/jerni-dev-darwin-arm64

