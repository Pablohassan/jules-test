# Dockerfile for the API service
FROM node:22-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

ENV CI=true

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build
RUN pnpm prune --prod

# ---

FROM node:22-slim AS production

WORKDIR /app

RUN npm install -g pnpm

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist /app/apps/api/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/pnpm-workspace.yaml /app/
COPY --from=builder /app/pnpm-lock.yaml /app/
COPY --from=builder /app/apps/api/package.json /app/apps/api/
COPY --from=builder /app/packages/shared/package.json /app/packages/shared/

CMD ["pnpm", "--filter", "api", "start"]
