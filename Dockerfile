# Development image used by docker-compose for both the api and worker
# services. Production on Render builds with `npm run build` instead.
FROM node:20-slim

# sharp and node-gyp need a toolchain for native builds on slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
