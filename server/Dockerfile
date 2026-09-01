# Server Dockerfile for CampusMind Express backend
# Handles native deps: @xenova/transformers (ONNX), pdf-parse (pdfjs), tesseract.js (WebAssembly)
FROM node:20-bookworm-slim AS base

# Install OS-level dependencies for native Node.js modules and ONNX runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      build-essential \
      git \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (cached layer)
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build layer (if needed for TypeScript or build scripts)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No build step for this pure-JS project; copy source as-is
RUN echo "Source copied"

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHON_PATH=/usr/bin/python3

USER root

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.example ./.env.example

# Create temp directory for async document processing
RUN mkdir -p /tmp

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodejs
USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const http=require('http');const r=http.get('http://localhost:5000/api/health',(res)=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
