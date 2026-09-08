FROM node:22

WORKDIR /app

# Install server dependencies first (better layer caching)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy application code + migrations
COPY db ./db
COPY server ./server

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "const http=require('http');http.get('http://localhost:5001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Run migrations (idempotent) before starting the server
CMD ["sh", "-c", "node ../db/migrate.mjs && node server.js"]
