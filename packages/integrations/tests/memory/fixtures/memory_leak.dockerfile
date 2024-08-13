FROM oven/bun

## set current working directory
WORKDIR /usr/app

EXPOSE 4000
COPY cli-linux .


ENTRYPOINT ["./cli-linux"]


