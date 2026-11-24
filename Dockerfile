FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Prisma needs openssl for some database drivers
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
