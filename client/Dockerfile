FROM node:22-alpine AS build

RUN corepack enable && npm install -g npm@11

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN if [ ! -d dist ]; then \
      echo "ERROR: Build output directory 'dist/' not found. Vite build may have failed." >&2; \
      exit 1; \
    fi

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
