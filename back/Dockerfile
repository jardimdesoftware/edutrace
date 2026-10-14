FROM node:24-alpine3.22 AS builder

WORKDIR /usr/src/api

RUN apk upgrade --no-cache

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:24-alpine3.22 AS production

WORKDIR /usr/src/api
ENV NODE_ENV=production

RUN apk upgrade --no-cache

COPY --from=builder --chown=node:node /usr/src/api/node_modules ./node_modules
COPY --from=builder --chown=node:node /usr/src/api/package*.json ./
COPY --from=builder --chown=node:node /usr/src/api/prisma ./prisma
COPY --from=builder --chown=node:node /usr/src/api/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /usr/src/api/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(()=>{}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main"]
