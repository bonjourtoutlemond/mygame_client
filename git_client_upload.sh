#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="${CLIENT_DIR:-$SCRIPT_DIR}"
CLIENT_REPO_URL="${CLIENT_REPO_URL:-https://github.com/bonjourtoutlemond/mygame_client.git}"
CLIENT_SSH_REPO_URL="${CLIENT_SSH_REPO_URL:-git@github.com:bonjourtoutlemond/mygame_client.git}"
CLIENT_REPO_REF="${CLIENT_REPO_REF:-main}"
COMMIT_MSG="${*:-Update client $(date '+%Y-%m-%d %H:%M:%S')}"
LOG_FILE="${LOG_FILE:-$CLIENT_DIR/logs/git_client_upload.log}"

mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1
echo ""
echo "===== git_client_upload started: $(date '+%Y-%m-%d %H:%M:%S') ====="

log() {
  printf '[client-upload] %s\n' "$*"
}

die() {
  printf '[client-upload][ERROR] %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
Usage:
  ./git_client_upload.sh "commit message"

Environment:
  CLIENT_DIR          Target directory. Default: script directory.
  CLIENT_REPO_URL     HTTPS remote. Default: https://github.com/bonjourtoutlemond/mygame_client.git
  CLIENT_SSH_REPO_URL SSH remote fallback. Default: git@github.com:bonjourtoutlemond/mygame_client.git
  CLIENT_REPO_REF     Branch/tag. Default: main.
  LOG_FILE            Default: \$CLIENT_DIR/logs/git_client_upload.log
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

command -v git >/dev/null 2>&1 || die "git not found in PATH"

check_git_https() {
  local exec_path
  exec_path="$(git --exec-path 2>/dev/null || echo '')"
  [[ -n "$exec_path" ]] && [[ -x "${exec_path}/git-remote-https" ]]
}

has_ssh_key() {
  ls ~/.ssh/id_*.pub >/dev/null 2>&1
}

ensure_ssh_key() {
  if has_ssh_key; then
    return 0
  fi

  log "No SSH key found. Creating ~/.ssh/id_ed25519..."
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -q
  echo ""
  echo "============================================================"
  echo "Add this public key to GitHub Deploy keys with write access:"
  echo "https://github.com/bonjourtoutlemond/mygame_client/settings/keys"
  echo "============================================================"
  cat ~/.ssh/id_ed25519.pub
  echo "============================================================"
  echo "After adding it, rerun: ./git_client_upload.sh \"$COMMIT_MSG\""
  echo "============================================================"
  return 1
}

mkdir -p "$CLIENT_DIR"
cd "$CLIENT_DIR"

log "Workdir: $CLIENT_DIR"
log "Remote : $CLIENT_REPO_URL"
log "Branch : $CLIENT_REPO_REF"
log "Message: $COMMIT_MSG"

cat > .gitignore <<'EOF'
node_modules
data
logs
*.log
EOF

if [[ ! -d .git ]]; then
  log "Initializing client repository..."
  git init
else
  log "Existing client repository found."
fi

git branch -M "$CLIENT_REPO_REF"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$CLIENT_REPO_URL"
else
  git remote add origin "$CLIENT_REPO_URL"
fi

log "Staging client files..."
git add --all -- .
git reset -q -- node_modules node_modules/ data data/ logs logs/ 2>/dev/null || true

log "Current client status:"
git status --short
echo

if ! git diff --cached --quiet; then
  log "Creating commit: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG"
else
  log "Nothing staged to commit."
fi

if check_git_https; then
  log "Pushing via HTTPS..."
  git push -u origin "$CLIENT_REPO_REF"
else
  log "git-remote-https is unavailable. Falling back to SSH."
  if ! ensure_ssh_key; then
    log "Local commit is done. Add the key above to GitHub, then rerun this script."
    exit 0
  fi
  git remote set-url origin "$CLIENT_SSH_REPO_URL"
  log "Pushing via SSH..."
  git push -u origin "$CLIENT_REPO_REF"
fi

log "Local client code uploaded to git."
log "Log: $LOG_FILE"
