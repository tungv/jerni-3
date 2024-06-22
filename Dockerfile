FROM oven/bun
LABEL maintainer="BodiData"

WORKDIR /usr/app

COPY ./ ./

WORKDIR /usr/app/packages/jerni-store-mongodb
RUN bun link

WORKDIR /usr/app/packages/jerni
RUN bun link
RUN bun build ./src/cli.ts --compile --outfile ./src/mycli

WORKDIR /usr/app
RUN bun install

CMD ["bunx", "jerni", "./packages/jerni-models/index.ts"]
