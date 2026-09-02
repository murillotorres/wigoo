# ---- build: instala tudo (inclusive dev) e compila TS -> JS ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime: só o necessário pra rodar ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
COPY --from=build /app/dist ./dist
COPY package.json ./
USER appuser
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
