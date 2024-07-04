# isolate jerni so that all the dependencies are installed in the build directory
cp -r packages/jerni build

# install all the dependencies, node_modules with all packages will be installed
cd build
bun install