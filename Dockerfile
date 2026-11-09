# ==============================================================================
# SOAPI Web Application Dockerfile (TanStack Start / Nitro SSR)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

ENV NITRO_PRESET=node-server

COPY package*.json ./
# Install seluruh dependencies termasuk devDependencies (Vite, Nitro, Lovable config) untuk build
RUN npm ci --include=dev

COPY . .
# Jalankan build dengan NODE_ENV=production agar JSX menggunakan production runtime (bukan jsxDEV)
RUN NODE_ENV=production NITRO_PRESET=node-server npm run build

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
