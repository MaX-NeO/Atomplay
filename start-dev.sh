#!/bin/bash
# Respawn loop: keeps `next dev` alive even if the sandbox reaps it.
cd /home/z/my-project

# Export Neon PostgreSQL connection strings (override system-level SQLite value)
export DATABASE_URL="postgresql://neondb_owner:npg_8AIqkTSGN7Kj@ep-bold-snow-a16cf764-pooler.ap-southeast-1.aws.neon.tech/Atom-Play?sslmode=require"
export DATABASE_URL_UNPOOLED="postgresql://neondb_owner:npg_8AIqkTSGN7Kj@ep-bold-snow-a16cf764.ap-southeast-1.aws.neon.tech/Atom-Play?sslmode=require&channel_binding=require"

# Export app secrets
export APP_SECRET="ao35d65pKtuYJsYJWN/u/9Pp3K9q9jp8Fv/z39dRW0U="
export NEXTAUTH_SECRET="ao35d65pKtuYJsYJWN/u/9Pp3K9q9jp8Fv/z39dRW0U="
export NEXTAUTH_URL="http://localhost:3000"

while true; do
  node ./node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[start-dev.sh] next dev exited with code $?, respawning in 3s..." >> /home/z/my-project/dev.log 2>&1
  sleep 3
done
