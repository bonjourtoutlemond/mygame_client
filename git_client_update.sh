#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="${CLIENT_DIR:-$SCRIPT_DIR}"
CLIENT_REPO_URL="${CLIENT_REPO_URL:-https://github.com/bonjourtoutlemond/mygame_client.git}"
CLIENT_REPO_REF="${CLIENT_REPO_REF:-main}"
LOG_FILE="${LOG_FILE:-$CLIENT_DIR/logs/git_client_update.log}"

mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1
echo ""
echo "===== git_client_update started: $(date '+%Y-%m-%d %H:%M:%S') ====="

log() {
  printf '[client-update] %s\n' "$*"
}

die() {
  printf '[client-update][ERROR] %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
Usage:
  ./git_client_update.sh

Environment:
  CLIENT_DIR       Target directory. Default: script directory.
  CLIENT_REPO_URL  Default: https://github.com/bonjourtoutlemond/mygame_client.git
  CLIENT_REPO_REF  Branch/tag. Default: main.
  LOG_FILE         Default: \$CLIENT_DIR/logs/git_client_update.log
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

command -v git >/dev/null 2>&1 || die "git not found in PATH"

mkdir -p "$CLIENT_DIR"

log "Workdir: $CLIENT_DIR"
log "Remote : $CLIENT_REPO_URL"
log "Branch : $CLIENT_REPO_REF"

cd "$CLIENT_DIR"

if [[ ! -d .git ]]; then
  log "Initializing client repository..."
  git init
fi

git branch -M "$CLIENT_REPO_REF"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$CLIENT_REPO_URL"
else
  git remote add origin "$CLIENT_REPO_URL"
fi

log "Pulling origin/$CLIENT_REPO_REF if it exists..."
if git ls-remote --exit-code --heads origin "$CLIENT_REPO_REF" >/dev/null 2>&1; then
  git pull origin "$CLIENT_REPO_REF" --allow-unrelated-histories --no-edit
else
  log "Remote branch not found or origin unavailable. Nothing was pulled."
fi

log "Client repository updated from git."
log "Log: $LOG_FILE"
