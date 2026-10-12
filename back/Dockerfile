FROM node:24-alpine3.22

RUN apk upgrade --no-cache && npm install -g npm@12.2.0 && npm config set allow-remote true

WORKDIR /usr/src/api

COPY package*.json ./
RUN npm ci

COPY . .

# Prisma v7 removeu o postinstall automático: precisa gerar o client antes do build
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

# Roda sem root. Os arquivos da imagem continuam do root, então o processo não
# consegue reescrever o próprio código nem o Prisma Client gerado no build.
USER node

# CMD final: aplica migrations, roda o seed e sobe a app
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run start:prod"]
