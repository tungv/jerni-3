FROM oven/bun
LABEL maintainer="BodiData"

WORKDIR /usr/app

COPY ./ ./

WORKDIR /usr/app/packages/jerni-store-mongodb
RUN bun link

WORKDIR /usr/app/packages/jerni
RUN bun link

WORKDIR /usr/app
RUN bun install

WORKDIR /usr/app/packages/jerni-models
CMD ["bun", "run", "index.ts"]
