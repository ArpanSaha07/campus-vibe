# Shared dependency layer so the dev and production paths install once.
FROM node:24-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
# npm ci, not npm install: CI runs `npm ci` and so enforces the lockfile, while
# `npm install` is free to resolve a different tree from the same commit. Two
# dependency graphs for one commit is exactly the drift the lockfile exists to
# prevent.
RUN npm ci

# Development image, selected by `build.target: dev` in docker/docker-compose.yml.
# `next dev` keeps a compiler running, which is what makes the files that
# `docker compose watch` syncs in actually show up in the browser. The default
# production image below has no compiler, so a sync into it is a no-op.
FROM node:24-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
# Compose `sync` writes into the container's own filesystem, so inotify fires
# normally and polling is not needed. Uncomment if HMR ever stops reacting.
# ENV WATCHPACK_POLLING=true
# ENV CHOKIDAR_USEPOLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# Last stage, so this stays the default target for production builds.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
