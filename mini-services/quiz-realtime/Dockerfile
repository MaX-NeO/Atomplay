# Dockerfile for quiz-realtime mini-service (SELF-CONTAINED)
#
# This Dockerfile works with mini-services/quiz-realtime/ as the Docker build
# context (i.e. Render "Root Directory" = mini-services/quiz-realtime).
#
# On Render:
#   Root Directory:   mini-services/quiz-realtime
#   Dockerfile Path:  Dockerfile   (or leave blank — auto-detected)
#
# The prisma/schema.prisma file is copied into this directory so the Docker
# build context contains everything it needs. Keep it in sync with the parent
# ../../prisma/schema.prisma (run the sync script if you change the schema).
#
# Build locally (from mini-services/quiz-realtime/):
#   docker build -t atomplay-quiz-realtime .
#
# Run:
#   docker run -p 3003:3003 \
#     -e DATABASE_URL='postgresql://...' \
#     -e DATABASE_URL_UNPOOLED='postgresql://...' \
#     -e CORS_ORIGIN='https://your-app.vercel.app' \
#     atomplay-quiz-realtime

FROM oven/bun:1.1 AS base

WORKDIR /app

# Copy package files first (for layer caching)
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy the local Prisma schema + generate the client
COPY prisma ./prisma
RUN bunx prisma generate --schema=./prisma/schema.prisma

# Copy the mini-service source code
COPY index.ts prisma.ts types.ts tsconfig.json ./

# Expose the port (Render sets PORT env var automatically)
EXPOSE 3003

# Health check (Render uses the /health endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:'+(process.env.PORT||3003)+'/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Start the service
CMD ["bun", "index.ts"]
