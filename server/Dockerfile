FROM node:22-alpine

RUN npm install -g npm@11

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

RUN npx playwright install --with-deps chromium

COPY . .

RUN mkdir -p uploads keys && \
    chown -R node:node /app

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

USER node

CMD ["node", "server.js"]
