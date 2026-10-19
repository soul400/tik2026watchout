#!/usr/bin/env bash
# ==============================================================================
# LivePulse Intelligence Lab 2.0 — Hardened Production Deployment Script
# Target SHA: Pinned release commit supplied explicitly via argument or env var
# Previous Stable SHA: 2118ee3dbd2d277f5892d2de0a567381080d1ece
# ==============================================================================
set -euo pipefail
IFS=$'\n\t'

# Target Commit Specification: Must be provided explicitly via parameter or environment variable
TARGET_SHA="${1:-${RELEASE_TARGET_SHA:-}}"
PREVIOUS_STABLE_SHA="2118ee3dbd2d277f5892d2de0a567381080d1ece"
MIN_FREE_DISK_KB=8000000 # 8 GB minimum free space required

# ------------------------------------------------------------------------------
# PRE-FLIGHT VALIDATION: Strict Release Target Commit Resolution
# ------------------------------------------------------------------------------
if [ -z "${TARGET_SHA}" ]; then
  echo "ERROR: Target release commit SHA was not provided!"
  echo "Usage: $0 <RELEASE_COMMIT_SHA>"
  echo "   or: RELEASE_TARGET_SHA=<RELEASE_COMMIT_SHA> $0"
  exit 1
fi

# Reject invalid SHA formats (must be 7 to 40 hexadecimal characters)
if ! [[ "${TARGET_SHA}" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "ERROR: Target '${TARGET_SHA}' is not a valid Git SHA (must be 7-40 hexadecimal characters)."
  echo "Mutable branch names or tags are forbidden as deployment targets."
  exit 1
fi

# Ensure commit object exists in local/remote Git repository
git fetch origin >/dev/null 2>&1 || true
if ! RESOLVED_TARGET_SHA=$(git rev-parse --verify "${TARGET_SHA}^{commit}" 2>/dev/null); then
  echo "ERROR: Target '${TARGET_SHA}' does not resolve to an existing commit object in this repository!"
  exit 1
fi

TARGET_SHA="${RESOLVED_TARGET_SHA}"

# Global Settings
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
LOG_FILE="/tmp/livepulse_deploy_${TIMESTAMP}.log"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/livepulse}"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "=================================================================="
echo "  LivePulse Intelligence Lab 2.0 — Production Release Gate"
echo "  Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "  Target Release Commit: ${TARGET_SHA}"
echo "  Deploy Log: ${LOG_FILE}"
echo "=================================================================="

# Failure Trap Handler
cleanup_on_failure() {
  local exit_code=$?
  local failed_line=$1
  local failed_command=$2
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "CRITICAL: Deployment FAILED at line ${failed_line}: '${failed_command}'"
  echo "Exit Code: ${exit_code}"
  echo "Log Preserved at: ${LOG_FILE}"
  echo "Database will NOT be modified or automatically restored to prevent data loss."
  echo "Attempting safe restart of designated services (livepulse-web, livepulse-worker)..."
  pm2 restart livepulse-web livepulse-worker || true
  echo "Service recovery attempted. Inspect log and follow the manual rollback runbook."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  exit "${exit_code}"
}
trap 'cleanup_on_failure ${LINENO} "$BASH_COMMAND"' ERR

# ------------------------------------------------------------------------------
# STEP 1: Prerequisite & Dependency Checks
# ------------------------------------------------------------------------------
echo -e "\n[STEP 1/8] Verifying Host Dependencies & Available Resources..."
for cmd in git node npm npx curl jq; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "ERROR: Required command '$cmd' is not installed or not in PATH."
    exit 1
  fi
done

# Verify SQLite backup capability
if ! command -v sqlite3 &> /dev/null; then
  echo "WARNING: sqlite3 CLI not found in PATH. Checking Node.js SQLite fallback..."
  # sqlite3 is strongly recommended for online backup. Operator must install sqlite3 or provide tools.
  echo "ERROR: 'sqlite3' CLI tool is required for atomic online database backup. Install via 'apt install sqlite3'."
  exit 1
fi

echo "Node: $(node -v) | NPM: $(npm -v) | SQLite3: $(sqlite3 --version | cut -d' ' -f1)"

# Check available disk space
mkdir -p "${BACKUP_DIR}"
AVAILABLE_DISK_KB=$(df -k "${BACKUP_DIR}" | awk 'NR==2 {print $4}')
if [ "${AVAILABLE_DISK_KB}" -lt "${MIN_FREE_DISK_KB}" ]; then
  echo "ERROR: Insufficient disk space in ${BACKUP_DIR}. Available: ${AVAILABLE_DISK_KB} KB, Required: ${MIN_FREE_DISK_KB} KB."
  exit 1
fi
echo "Disk space verified: $((AVAILABLE_DISK_KB / 1024)) MB available."

# ------------------------------------------------------------------------------
# STEP 2: Database Path Discovery
# ------------------------------------------------------------------------------
echo -e "\n[STEP 2/8] Discovering Production Database Path..."
PROD_DB=""
if [ -n "${DATABASE_URL:-}" ]; then
  PROD_DB="${DATABASE_URL#file:}"
  PROD_DB="${PROD_DB%%\?*}"
elif [ -f ".env.production" ] && grep -q '^DATABASE_URL=' ".env.production"; then
  PROD_DB="$(grep '^DATABASE_URL=' .env.production | cut -d '=' -f2- | tr -d '\"' | tr -d '\'')"
  PROD_DB="${PROD_DB#file:}"
  PROD_DB="${PROD_DB%%\?*}"
elif [ -f ".env" ] && grep -q '^DATABASE_URL=' ".env"; then
  PROD_DB="$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '\"' | tr -d '\'')"
  PROD_DB="${PROD_DB#file:}"
  PROD_DB="${PROD_DB%%\?*}"
else
  PROD_DB="prisma/dev.db"
fi

if [[ "$PROD_DB" != /* ]]; then
  PROD_DB="$(pwd)/${PROD_DB}"
fi

echo "Target Production Database: ${PROD_DB}"
if [ ! -f "${PROD_DB}" ]; then
  echo "ERROR: Database file '${PROD_DB}' does not exist!"
  exit 1
fi

# ------------------------------------------------------------------------------
# STEP 3: Complete Writer Quiescence & Verified SQLite Backup
# ------------------------------------------------------------------------------
echo -e "\n[STEP 3/8] Quiescing ALL Database Writers & Taking Atomic Backup..."
BACKUP_FILE="${BACKUP_DIR}/livepulse_pre_deploy_${TIMESTAMP}.db"

echo "Stopping all active database writers (livepulse-worker and livepulse-web)..."
pm2 stop livepulse-worker livepulse-web 2>/dev/null || true

echo "Executing PRAGMA wal_checkpoint(TRUNCATE) on production DB..."
CHECKPOINT_RESULT=$(sqlite3 "${PROD_DB}" "PRAGMA wal_checkpoint(TRUNCATE);")
echo "Checkpoint output (busy|log|checkpointed): ${CHECKPOINT_RESULT}"

CHECKPOINT_BUSY=$(echo "${CHECKPOINT_RESULT}" | cut -d'|' -f1)
if [ "${CHECKPOINT_BUSY}" != "0" ]; then
  echo "ERROR: SQLite WAL checkpoint returned busy=${CHECKPOINT_BUSY}. Active connections remain. Aborting!"
  exit 1
fi

echo "Creating atomic SQLite Online Backup to ${BACKUP_FILE}..."
sqlite3 "${PROD_DB}" ".backup '${BACKUP_FILE}'"

if [ ! -f "${BACKUP_FILE}" ] || [ ! -s "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file was not created or is empty!"
  exit 1
fi

echo "Verifying backup database integrity..."
BACKUP_INTEGRITY=$(sqlite3 "${BACKUP_FILE}" "PRAGMA integrity_check;")
if [ "${BACKUP_INTEGRITY}" != "ok" ]; then
  echo "ERROR: Backup integrity check failed: ${BACKUP_INTEGRITY}"
  exit 1
fi

echo "Verifying backup foreign key constraints..."
BACKUP_FK=$(sqlite3 "${BACKUP_FILE}" "PRAGMA foreign_key_check;")
if [ -n "${BACKUP_FK}" ]; then
  echo "ERROR: Backup foreign key check failed with violations: ${BACKUP_FK}"
  exit 1
fi

echo "Verifying record counts match source database..."
RAW_COUNT_SRC=$(sqlite3 "${PROD_DB}" "SELECT COUNT(*) FROM RawEvent;")
RAW_COUNT_BAK=$(sqlite3 "${BACKUP_FILE}" "SELECT COUNT(*) FROM RawEvent;")
SUPP_COUNT_SRC=$(sqlite3 "${PROD_DB}" "SELECT COUNT(*) FROM Supporter;")
SUPP_COUNT_BAK=$(sqlite3 "${BACKUP_FILE}" "SELECT COUNT(*) FROM Supporter;")

if [ "${RAW_COUNT_SRC}" != "${RAW_COUNT_BAK}" ] || [ "${SUPP_COUNT_SRC}" != "${SUPP_COUNT_BAK}" ]; then
  echo "ERROR: Backup count discrepancy! RawEvents: src=${RAW_COUNT_SRC} bak=${RAW_COUNT_BAK} | Supporters: src=${SUPP_COUNT_SRC} bak=${SUPP_COUNT_BAK}"
  exit 1
fi

echo "Verifying isolated readability from backup copy..."
READ_PROBE=$(sqlite3 "${BACKUP_FILE}" "SELECT id, eventType FROM RawEvent LIMIT 1;")
if [ -z "${READ_PROBE}" ]; then
  echo "ERROR: Failed to read baseline probe record from backup!"
  exit 1
fi
echo "Backup Verified: Size=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}") bytes | RawEvents=${RAW_COUNT_BAK} | Supporters=${SUPP_COUNT_BAK} | Integrity=${BACKUP_INTEGRITY} | FK=ok"

# ------------------------------------------------------------------------------
# STEP 4: Checkout Target SHA & Install Dependencies
# ------------------------------------------------------------------------------
echo -e "\n[STEP 4/8] Checking Out Target SHA (${TARGET_SHA})..."
git fetch origin
git checkout "${TARGET_SHA}"
CURRENT_HEAD=$(git rev-parse HEAD)
if [ "${CURRENT_HEAD}" != "${TARGET_SHA}" ]; then
  echo "ERROR: Expected HEAD to be ${TARGET_SHA}, but got ${CURRENT_HEAD}"
  exit 1
fi

echo "Installing production dependencies..."
npm ci --prefer-offline --no-audit

# ------------------------------------------------------------------------------
# STEP 5: Database Schema Evolution
# ------------------------------------------------------------------------------
echo -e "\n[STEP 5/8] Synchronizing Prisma Schema..."
npx prisma generate
npx prisma db push --skip-generate

# ------------------------------------------------------------------------------
# STEP 6: Execute Idempotent Historical Backfill
# ------------------------------------------------------------------------------
echo -e "\n[STEP 6/8] Executing Historical Backfill CLI..."
npx tsx scripts/production-backfill.ts --batch-size 500 --max-batches 2000 --allowed-unresolved 2

# ------------------------------------------------------------------------------
# STEP 7: Next.js Production Build
# ------------------------------------------------------------------------------
echo -e "\n[STEP 7/8] Building Next.js Application..."
npm run build

# Record deployed version
echo "${TARGET_SHA}" > /tmp/livepulse_deployed_version.txt

# ------------------------------------------------------------------------------
# STEP 8: Restart Designated Services & Multi-Stage Health Verification
# ------------------------------------------------------------------------------
echo -e "\n[STEP 8/8] Starting Services & Running Health Checks..."
pm2 restart livepulse-web livepulse-worker || {
  echo "Designated processes not found. Starting livepulse-web and livepulse-worker explicitly..."
  pm2 start npm --name "livepulse-web" -- start
  pm2 start npm --name "livepulse-worker" -- run worker
}

echo "Waiting for services to initialize (15s)..."
sleep 15

HEALTH_URL="http://localhost:3000/api/health"
MAX_ATTEMPTS=8
ATTEMPT=1
HEALTH_PASS=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo "Health Check Attempt ${ATTEMPT}/${MAX_ATTEMPTS}..."
  HTTP_STATUS=$(curl -s -o /tmp/health_response.json -w "%{http_code}" "${HEALTH_URL}" || echo "000")

  if [ "${HTTP_STATUS}" -eq 200 ]; then
    OVERALL_HEALTH=$(jq -r '.overallHealth // empty' /tmp/health_response.json 2>/dev/null || echo "UNKNOWN")
    DB_STATUS=$(jq -r '.components.database.status // empty' /tmp/health_response.json 2>/dev/null || echo "UNKNOWN")
    WORKER_STATUS=$(jq -r '.components.worker.status // empty' /tmp/health_response.json 2>/dev/null || echo "UNKNOWN")

    echo "HTTP Status: ${HTTP_STATUS} | Overall: ${OVERALL_HEALTH} | DB: ${DB_STATUS} | Worker: ${WORKER_STATUS}"

    # Enforce strictly HEALTHY for overall, db, and worker components
    if [ "${OVERALL_HEALTH}" = "HEALTHY" ] && [ "${DB_STATUS}" = "HEALTHY" ] && [ "${WORKER_STATUS}" = "HEALTHY" ]; then
      HEALTH_PASS=1
      break
    fi
  else
    echo "HTTP Status returned: ${HTTP_STATUS}"
  fi
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $HEALTH_PASS -ne 1 ]; then
  echo "ERROR: Health check failed to meet HEALTHY criteria after ${MAX_ATTEMPTS} attempts!"
  cat /tmp/health_response.json 2>/dev/null || true
  exit 1
fi

# Verify Worker PM2 Process
echo "Verifying PM2 worker process status..."
if pm2 jlist | jq -e '.[] | select(.name=="livepulse-worker") | .pm2_env.status == "online"' > /dev/null 2>&1; then
  echo "PM2 Worker is verified ONLINE."
else
  echo "WARNING: PM2 Worker status is not 'online'. Please check 'pm2 logs livepulse-worker'."
fi

echo -e "\n=================================================================="
echo "  LivePulse Intelligence Lab 2.0 — DEPLOYMENT SUCCESSFUL!"
echo "  Active Commit: $(git rev-parse --short HEAD)"
echo "  Backup Retained at: ${BACKUP_FILE}"
echo "=================================================================="
exit 0
