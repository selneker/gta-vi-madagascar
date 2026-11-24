# --- Build stage: compile TypeScript (needs devDependencies) ---
FROM node:22-alpine AS build
WORKDIR /app

# Prisma needs openssl for some database drivers
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage: production dependencies + compiled output only ---
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci && npx prisma generate && npm prune --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "dist/index.js"]
