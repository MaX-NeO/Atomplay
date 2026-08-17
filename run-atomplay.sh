#!/bin/bash
# Atom Play launcher — exports Neon PostgreSQL env vars (overriding the
# sandbox's system-level SQLite DATABASE_URL), starts `bun run dev` in the
# BACKGROUND, disowns it so it is reparented to init (PID 1) and survives
# the originating Bash session, then exits.
#
# This mirrors the .zscripts/dev.sh "disown + unset PID" persistence pattern
# while ensuring the correct DATABASE_URL reaches the Next.js runtime.

set -u

cd /home/z/my-project

# ─── Export Neon PostgreSQL + app secrets (override system SQLite) ───
# NOTE: We use the DIRECT (un-pooled) Neon endpoint for the runtime
# DATABASE_URL too, because the `-pooler` (PgBouncer) endpoint proved
# unreachable from this sandbox at runtime (Prisma query engine IPv6 issue:
# "Can't reach database server"). The direct endpoint works for both the
# Prisma CLI and the runtime query engine — fine for a single long-running
# dev server.
export DATABASE_URL="postgresql://neondb_owner:npg_fSZYz9Rq5DuG@ep-summer-mud-aztf6wec.c-3.ap-southeast-1.aws.neon.tech/Atom-Play?sslmode=require&channel_binding=require"
export DATABASE_URL_UNPOOLED="postgresql://neondb_owner:npg_fSZYz9Rq5DuG@ep-summer-mud-aztf6wec.c-3.ap-southeast-1.aws.neon.tech/Atom-Play?sslmode=require&channel_binding=require"
export APP_SECRET="ao35d65pKtuYJsYJWN/u/9Pp3K9q9jp8Fv/z39dRW0U="
export NEXTAUTH_SECRET="ao35d65pKtuYJsYJWN/u/9Pp3K9q9jp8Fv/z39dRW0U="
export NEXTAUTH_URL="http://localhost:3000"

# Kill any existing dev server so we don't bind two on :3000.
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f "bun --hot index.ts" 2>/dev/null || true
sleep 2

rm -f /home/z/my-project/dev.log

# ─── Start the dev server in the background ───
# `bun run dev` = `next dev -p 3000 2>&1 | tee dev.log`. The instrumentation.ts
# hook (auto-detected by Next.js) will spawn the quiz-realtime mini-service on
# :3003 as a detached child.
bun run dev >> /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!
echo "[run-atomplay] dev server started, PID=$DEV_PID"

# Disown + unset so the EXIT trap (if any) does not kill it. After this script
# exits, the dev server is reparented to init (PID 1, tini) and persists.
disown "$DEV_PID" 2>/dev/null || true
unset DEV_PID

# ─── Wait for the server to be ready ───
for i in $(seq 1 60); do
  if curl -s --connect-timeout 2 --max-time 5 http://localhost:3000 > /dev/null 2>&1; then
    echo "[run-atomplay] Next.js dev server is ready on :3000"
    break
  fi
  sleep 1
done

# Final status
curl -s -o /dev/null -w "[run-atomplay] GET / -> HTTP %{http_code}\n" --max-time 10 http://localhost:3000/
curl -s -o /dev/null -w "[run-atomplay] :3003    -> HTTP %{http_code}\n" --max-time 5  http://localhost:3003/

echo "[run-atomplay] launcher exiting; dev server persists (reparented to init)."
