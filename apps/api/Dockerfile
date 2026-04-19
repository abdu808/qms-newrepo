FROM node:20-alpine

WORKDIR /app

# Install dependencies for Prisma, Puppeteer, and native module builds (bcrypt)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
    wget \
    python3 \
    make \
    g++

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files + prisma schema BEFORE npm install so postinstall (prisma generate) works
COPY package*.json ./
COPY prisma ./prisma/

# Install production deps. postinstall script auto-runs `prisma generate` using the local
# prisma CLI (now in dependencies). No network download needed at build time.
RUN npm install --omit=dev

# Copy source
COPY . .

# Create uploads directory and make startup script executable
RUN mkdir -p /app/uploads && chmod +x /app/startup.sh && chown -R node:node /app

USER node

EXPOSE 3000

# Deep healthcheck — pings the DB. Returns 503 on failure so the
# orchestrator restarts the container instead of serving 504s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- --timeout=4 http://127.0.0.1:3000/api/health/ready || exit 1

CMD ["/app/startup.sh"]
