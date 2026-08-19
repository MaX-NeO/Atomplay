#!/bin/bash
cd /home/z/my-project
export DATABASE_URL='postgresql://neondb_owner:npg_fSZYz9Rq5DuG@ep-summer-mud-aztf6wec.c-3.ap-southeast-1.aws.neon.tech/Atom-Play?sslmode=require'
export DATABASE_URL_UNPOOLED='postgresql://neondb_owner:npg_fSZYz9Rq5DuG@ep-summer-mud-aztf6wec.c-3.ap-southeast-1.aws.neon.tech/Atom-Play?sslmode=require'

# Start quiz-realtime
cd /home/z/my-project/mini-services/quiz-realtime
bun --hot index.ts > /home/z/my-project/quiz-realtime.log 2>&1 &
QUIZ_PID=$!

# Start Next.js
cd /home/z/my-project
while true; do
  node ./node_modules/.bin/next dev -p 3000 2>&1 | tee -a /home/z/my-project/dev.log
  echo "[launch.sh] next dev exited, respawning in 3s..." >> /home/z/my-project/dev.log 2>&1
  sleep 3
done
