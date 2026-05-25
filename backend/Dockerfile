FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY assets ./assets
COPY src ./src

RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seeds.ts && node dist/main.js"]
