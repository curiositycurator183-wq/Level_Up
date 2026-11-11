# Production Dockerfile for LEVEL UP (Unified Frontend + Backend + WebSockets)
FROM node:22-alpine

WORKDIR /app

# Copy root and subpackage definitions
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies
RUN npm run install:all

# Copy full source
COPY . .

# Build client and server
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
