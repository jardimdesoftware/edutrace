FROM node:24-alpine3.22

RUN apk upgrade --no-cache && npm install -g npm@latest

WORKDIR /usr/src/api

COPY package*.json ./
RUN npm ci

COPY . .

# Prisma v7 removeu o postinstall automático: precisa gerar o client antes do build
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

# CMD final: gera Prisma Client, aplica migrations e roda app
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run seed && npm run start:prod"]
