# Dockerfile for quiz-realtime mini-service
# Used for Docker-based deployments (Fly.io, Railway, VPS, AWS ECS, etc.)
#
# Build from the REPO ROOT (not from mini-services/quiz-realtime):
#   docker build -f mini-services/quiz-realtime/Dockerfile -t atomplay-quiz-realtime .
#
# Run:
#   docker run -p 3003:3003 \
#     -e DATABASE_URL='postgresql://...' \
#     -e DATABASE_URL_UNPOOLED='postgresql://...' \
#     -e CORS_ORIGIN='https://your-app.vercel.app' \
#     -e PORT=3003 \
#     atomplay-quiz-realtime

FROM oven/bun:1.1 AS base

WORKDIR /app

# Copy the Prisma schema + mini-service package files
COPY prisma ./prisma
COPY mini-services/quiz-realtime/package.json mini-services/quiz-realtime/bun.lock* ./

# Install dependencies
RUN bun install

# Generate Prisma client from the shared schema
RUN bunx prisma generate --schema=./prisma/schema.prisma

# Copy the mini-service source code
COPY mini-services/quiz-realtime/ ./

# Expose the port (Render/docker sets PORT env var)
EXPOSE 3003

# Health check (optional — Render uses the /health endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:'+(process.env.PORT||3003)+'/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Start the service
CMD ["bun", "index.ts"]
