FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=apps/api

FROM base AS build
COPY apps/api apps/api
COPY tsconfig.base.json .
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
