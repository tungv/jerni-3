FROM oven/bun

COPY docker-server.ts .
EXPOSE 4000

CMD ["bun", "run", "docker-server.ts"]