# Link all the packages that integrations uses. there is no way we can install only for jerni package
# when just copy the jerni package, bun does not create a node_modules folder in the jerni package, only in the root folder
# hence, jsr can not recognized the packages uses in jerni
cd packages/jerni
bun link
cd ../../packages/jerni-store-mongodb
bun link
cd ../..

# install all the dependencies, node_modules folders will be created in all the packages
bun install