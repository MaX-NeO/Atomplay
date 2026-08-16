#!/bin/bash
# Respawn loop: keeps `next dev` alive even if the sandbox reaps it.
cd /home/z/my-project
while true; do
  node ./node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[start-dev.sh] next dev exited with code $?, respawning in 3s..." >> /home/z/my-project/dev.log 2>&1
  sleep 3
done
