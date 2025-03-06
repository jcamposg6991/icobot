FROM node:21-bullseye-slim as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY package.json-lock.yaml ./
RUN pnpm install

COPY . .

RUN pnpm run build

FROM node:21-bullseye-slim as deploy

WORKDIR /app

ARG PORT
ENV PORT $PORT
EXPOSE $PORT

COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.json /app/-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate 
ENV PNPM_HOME=/usr/local/bin

RUN pnpm install --production --ignore-scripts

CMD ["npm", "start"]