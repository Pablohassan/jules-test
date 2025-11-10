# Dockerfile for the web application
FROM node:22-slim AS builder

WORKDIR /app

RUN npm install -g pnpm

ENV CI=true

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

# ---

FROM nginx:1.25-alpine AS production

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Add nginx config to proxy API and support SPA routing
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
