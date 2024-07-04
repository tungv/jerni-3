# isolate the jerni package to temporary ignore the other packages
mkdir build
mkdir build/packages
mkdir build/packages/jerni
cp package.json build/
cp bun.lockb build/
cp -r packages/jerni build/packages/

# install the dependencies
cd build/packages/jerni
bun install