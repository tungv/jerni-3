# isolate jerni so that all the dependencies are installed in the build director
cp -r packages/jerni build

# install the dependencies
cd build
bun install

bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile ./src/mycli-linux-x64
bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile ./src/mycli-darwin-x64
bun build ./src/cli.ts --compile --target=bun-windows-x64 --outfile ./src/mycli-win-x64
bun build ./src/cli.ts --compile --target=bun-linux-arm64 --outfile ./src/mycli-linux-arm64
bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile ./src/mycli-darwin-arm64
