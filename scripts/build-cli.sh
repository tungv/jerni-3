
# isolate the jerni package to temporary ignore the other packages
mkdir build
mkdir build/packages
mkdir build/packages/jerni
cp package.json build/
cp bun.lockb build/
cp -r packages/jerni build/packages/

# install the dependencies
cd build
bun install
cd packages/jerni
bun build ./src/cli.ts --compile --target=bun-linux-x64 --outfile ./src/mycli-linux-x64
bun build ./src/cli.ts --compile --target=bun-darwin-x64 --outfile ./src/mycli-darwin-x64
bun build ./src/cli.ts --compile --target=bun-windows-x64 --outfile ./src/mycli-win-x64
bun build ./src/cli.ts --compile --target=bun-linux-arm64 --outfile ./src/mycli-linux-arm64
bun build ./src/cli.ts --compile --target=bun-darwin-arm64 --outfile ./src/mycli-darwin-arm64
