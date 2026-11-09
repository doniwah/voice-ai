# ==============================================================================
# SOAPI Web Application Dockerfile (TanStack Start / Nitro SSR)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PRESET=node-server

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Production Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PRESET=node-server \
    PORT=3000

# Copy built server bundle and public assets
COPY --from=builder /app/.output .output
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
