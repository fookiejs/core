FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci
WORKDIR /repo/packages/demo
ENV DATABASE_URL=postgres://postgres:postgres@postgres:5432/fookie_demo
ENV REDIS_URL=redis://redis:6379
ENV API_PORT=3001
ENV API_BIND=0.0.0.0
ENV ANALYZE_PORT=4300
ENV ANALYZE_BIND=0.0.0.0
CMD ["node", "--import", "tsx", "src/main.ts"]
