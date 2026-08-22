#!/usr/bin/env bash
# Sync the Prisma schema from the parent project into the mini-service directory.
# Run this whenever you change prisma/schema.prisma in the repo root.
#
# Usage:
#   bash mini-services/quiz-realtime/sync-schema.sh
#
# This is needed because the Docker build context is mini-services/quiz-realtime/
# and Docker can't access files outside the context (../../prisma/schema.prisma).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/../../prisma/schema.prisma"
DEST="$SCRIPT_DIR/prisma/schema.prisma"

if [ ! -f "$SOURCE" ]; then
  echo "✗ Source schema not found: $SOURCE"
  exit 1
fi

mkdir -p "$SCRIPT_DIR/prisma"
cp "$SOURCE" "$DEST"
echo "✓ Synced Prisma schema: $SOURCE → $DEST"
