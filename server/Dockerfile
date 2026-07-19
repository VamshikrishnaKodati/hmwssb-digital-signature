FROM node:22

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

ENV CHROMIUM_PATH=/usr/bin/chromium

COPY . .

RUN mkdir -p uploads keys && \
    chown -R node:node /app

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

USER node

CMD ["node", "server.js"]
