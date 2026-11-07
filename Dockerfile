# Clelia & Co. platform — one image: API + built web app. Caddy in front handles HTTPS.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w apps/web

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/engine/package.json packages/engine/
RUN npm ci --omit=dev --no-audit --no-fund -w apps/api -w packages/engine && npm cache clean --force
COPY apps/api apps/api
COPY packages/engine packages/engine
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /data/storage && chown -R node:node /data /app
USER node
ENV PORT=4000 STORAGE_DIR=/data/storage WEB_DIST=/app/apps/web/dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/apps/api
CMD ["node", "src/server.js"]
