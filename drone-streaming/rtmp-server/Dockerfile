# ── Stage 1: Install deps ──────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install --production

# ── Stage 2: Runtime image ─────────────────────────────
FROM node:18-alpine
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY app.js .

RUN mkdir -p /app/media

EXPOSE 1935
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:8000/api/streams || exit 1

CMD ["node", "app.js"]
