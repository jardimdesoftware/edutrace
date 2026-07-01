FROM node:24-alpine3.22

WORKDIR /usr/src/api

COPY . .

RUN npm install --quiet --no-optional --no-fund --loglevel=error

# Prisma v7 removeu o postinstall automático: precisa gerar o client antes do build
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

# CMD final: gera Prisma Client, aplica migrations e roda app
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run seed && npm run start:prod"]
