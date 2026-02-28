FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the SvelteKit app
RUN npm run build

# ─── Production image ─────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# SvelteKit build output
COPY --from=builder /app/build ./build

# Custom server + Socket.IO handler (runs via tsx at runtime)
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/lib/server ./src/lib/server

# Drizzle config for auto-migration at startup
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Entrypoint: migrates DB schema, then starts server
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
