FROM oven/bun

## set current working directory
WORKDIR /usr/app

RUN bunx jsr add @jerni/jerni-3 @jerni/store-mongodb

EXPOSE 4000
COPY . .


ENTRYPOINT ["./cli-linux", "./init.ts"]


