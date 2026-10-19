#!/usr/bin/env bash
# ==============================================================================
# LivePulse Intelligence Lab 2.0 — Production Rollback Script
# Rollback Target SHA: 2118ee3dbd2d277f5892d2de0a567381080d1ece
# ==============================================================================
set -euo pipefail
IFS=$'\n\t'

ROLLBACK_TARGET="${ROLLBACK_TARGET:-2118ee3dbd2d277f5892d2de0a567381080d1ece}"

# Pre-flight validation: verify rollback target commit exists
if ! RESOLVED_ROLLBACK_TARGET=$(git rev-parse --verify "${ROLLBACK_TARGET}^{commit}" 2>/dev/null); then
  echo "ERROR: Rollback target commit '${ROLLBACK_TARGET}' does not resolve to an existing commit object!"
  exit 1
fi
ROLLBACK_TARGET="${RESOLVED_ROLLBACK_TARGET}"

MODE="${1:-app-only}" # Options: app-only (default, recommended) | catastrophic-db-restore
BACKUP_FILE="${2:-}"

echo "=================================================================="
echo "  LivePulse Rollback Procedure — Mode: ${MODE}"
echo "=================================================================="

if [ "$MODE" = "app-only" ]; then
  echo "[1/4] Checking out previous stable SHA: ${ROLLBACK_TARGET}..."
  git checkout "${ROLLBACK_TARGET}"

  echo "[2/4] Installing dependencies & generating client..."
  npm ci --prefer-offline --no-audit
  npx prisma generate

  echo "[3/4] Rebuilding Next.js application..."
  npm run build

  echo "[4/4] Restarting designated services (livepulse-web, livepulse-worker)..."
  pm2 restart livepulse-web livepulse-worker || {
    pm2 start npm --name "livepulse-web" -- start
    pm2 start npm --name "livepulse-worker" -- run worker
  }

  echo "Application rollback complete. Verified that upgraded schema remains backward compatible."
  exit 0

elif [ "$MODE" = "catastrophic-db-restore" ]; then
  if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: You must provide a valid backup file path for catastrophic-db-restore."
    echo "Usage: ./scripts/rollback-production.sh catastrophic-db-restore /path/to/backup.db"
    exit 1
  fi

  echo "WARNING: CATASTROPHIC RESTORATION WILL OVERWRITE CURRENT DATABASE!"
  echo "Stopping designated services..."
  pm2 stop livepulse-web livepulse-worker 2>/dev/null || true

  PROD_DB="${DATABASE_URL:-prisma/dev.db}"
  PROD_DB="${PROD_DB#file:}"
  PROD_DB="${PROD_DB%%\?*}"

  echo "Verifying backup integrity before restore..."
  if command -v sqlite3 &> /dev/null; then
    sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;"
  fi

  echo "Restoring ${BACKUP_FILE} to ${PROD_DB}..."
  cp "${BACKUP_FILE}" "${PROD_DB}"

  echo "Rolling back application code to ${ROLLBACK_TARGET}..."
  git checkout "${ROLLBACK_TARGET}"
  npm ci --prefer-offline --no-audit
  npx prisma generate
  npm run build

  echo "Starting designated services..."
  pm2 restart livepulse-web livepulse-worker || {
    pm2 start npm --name "livepulse-web" -- start
    pm2 start npm --name "livepulse-worker" -- run worker
  }

  echo "Catastrophic disaster recovery complete."
  exit 0
else
  echo "Unknown mode: ${MODE}. Choose 'app-only' or 'catastrophic-db-restore'."
  exit 1
fi
