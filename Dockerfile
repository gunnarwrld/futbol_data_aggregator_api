# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
# prisma.config.ts reads DATABASE_URL at load time. Generate does not connect.
ENV DATABASE_URL=postgresql://futbol:futbol@localhost:5432/futbol_data
RUN npx prisma generate && npx tsc

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json package-lock.json ./
# husky is a devDependency, so `prepare` cannot run in this stage.
RUN npm ci --omit=dev --ignore-scripts \
  && npm install --no-save --omit=dev prisma@7.8.0
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL=postgresql://futbol:futbol@localhost:5432/futbol_data
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
