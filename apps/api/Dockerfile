# Dockerfile for the API service
FROM node:24-trixie-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

# Avoid puppeteer download during install in builder; runtime image has Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true

# No apt-get; rely on Puppeteer to download Chromium during install

ENV CI=true

COPY . .

# Only install dependencies required for the API workspace to reduce image size
# and prevent ENOSPC issues during Prisma engine download.
RUN pnpm install --no-frozen-lockfile --filter ./apps/api...
RUN pnpm --filter api build
# Generate Prisma Client in builder stage so we can copy it into production
RUN pnpm --filter api exec prisma generate --schema ../../prisma/schema.prisma
# Note: Do not prune at the root here; we'll install prod deps in the final image scoped to api

# ---

FROM ghcr.io/puppeteer/puppeteer:24 AS production

WORKDIR /app

# Skip puppeteer download; this image already bundles a browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install system Chromium so we have a stable executable for headless rendering
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium && \
    rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
USER pptruser

ENV NODE_ENV=production

# Copy workspace manifests first, then install only api production deps
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/pnpm-workspace.yaml /app/
COPY --from=builder /app/pnpm-lock.yaml /app/
COPY --from=builder /app/apps/api/package.json /app/apps/api/
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/
COPY --from=builder /app/prisma /app/prisma

# Use pnpm from builder to avoid global install (permission issues as non-root)
# Ensure pptruser can write to /app and install pnpm via Corepack
USER root
RUN mkdir -p /app && chown -R pptruser:pptruser /app \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate
USER pptruser

RUN pnpm install --no-frozen-lockfile --prod --filter api...

# Copy generated Prisma client from builder (required at runtime)
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma

# Copy built output
COPY --from=builder /app/apps/api/dist /app/apps/api/dist

CMD ["sh", "-lc", "pnpm --filter api exec prisma migrate deploy --schema ../../prisma/schema.prisma && pnpm --filter api start"]
