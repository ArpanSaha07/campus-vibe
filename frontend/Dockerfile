# Shared dependency layer so the dev and production paths install once.
FROM node:26-alpine AS deps
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
FROM node:26-alpine AS dev
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

FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# Last stage, so this stays the default target for production builds.
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# npm is build-time tooling. Nothing below invokes it — the standalone bundle
# ships its own server.js and is started with plain node — and the copy of tar
# that npm bundles is a CRITICAL finding no tag of node:24-alpine currently
# fixes. Deleting the package manager clears the finding and removes a whole
# class of attack surface from a shipping image at the same time (BUG-016).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# `output: standalone` in next.config.ts produces a tree containing server.js
# and only the node_modules the build traced, so the devDependency tree stays
# out of production. Static assets and public/ are deliberately excluded from
# that trace and have to be copied alongside it.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# server.js binds to HOSTNAME, which defaults to localhost — unreachable from
# outside the container however the port is published.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
