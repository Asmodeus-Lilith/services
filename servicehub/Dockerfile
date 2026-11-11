# Build the React app and run it from the API container as a single origin.
FROM node:24-alpine AS web-build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.mjs ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/src ./server/src
COPY --from=web-build /workspace/build ./build

USER node
EXPOSE 4000
CMD ["sh", "-c", "node server/src/migrate.js && node server/src/seed.js && unset BOOTSTRAP_ADMIN_PASSWORD && exec node server/src/index.js"]
