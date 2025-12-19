FROM node:20-bullseye-slim

WORKDIR /app

# Install deps (better cache)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy server code
COPY . .

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000
CMD ["node", "index.js"]
