# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build
RUN pnpm build

# Stage 3: Production
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S waitlist && adduser -S waitlist -u 1001
WORKDIR /app

COPY --from=build --chown=waitlist:waitlist /app/package.json ./
COPY --from=build --chown=waitlist:waitlist /app/node_modules ./node_modules
COPY --from=build --chown=waitlist:waitlist /app/packages ./packages
COPY --from=build --chown=waitlist:waitlist /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=waitlist:waitlist /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=waitlist:waitlist /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build --chown=waitlist:waitlist /app/apps/admin/dist ./apps/admin/dist

USER waitlist
EXPOSE 3400

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/server.js"]
