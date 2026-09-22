# Node 22 slim: the deps are pure JS (no native/build tools), so the large
# buildpack-deps image (node:22) only dragged in unused packages (chromium,
# openssh-client, perl, ...) and their CVEs. bookworm-slim drops that cruft.
FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies at /app so the shared node_modules root covers both
# server/ (server.js) and db/ (migrate.mjs, seeds) via plain Node resolution.
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy application code + migrations
COPY db ./db
COPY server ./server

# Drop the bundled npm CLI: it ships vulnerable modules (tar) we never use at
# runtime; plain `npm install` emerged as the only reason it's aboard.
# ponytail: removing npm means no `docker exec ... npm` in the container,
# re-add if interactive package management becomes a requirement.
RUN rm -rf /usr/local/lib/node_modules/npm

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:5001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Run migrations (idempotent) before starting the server
CMD ["sh", "-c", "node ../db/migrate.mjs && node server.js"]
