# DHĪ API (NestJS + Prisma). Build context is this folder: docker build -t edumanage-api .
# Debian (glibc), not Alpine: argon2 ships a glibc prebuilt binary.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "prebuild" runs `prisma generate`, then nest build. prisma.config.ts insists on DATABASE_URL being
# set, but generating the client never connects, so a placeholder (this one command only) is enough.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    STORAGE_DIR=/data/storage
# openssl: Prisma's migration engine. tini: reaps zombies and forwards SIGTERM for clean shutdown.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data/storage && chown -R node:node /data
WORKDIR /app
# Dev dependencies stay: `prisma migrate deploy` and the one-off seed (tsx) need them.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "sh", "/app/docker-entrypoint.sh"]
