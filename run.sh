#!/usr/bin/env bash
# Runs backend (NestJS) and frontend (Quasar) dev servers together. Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

for app in backend frontend; do
  if [ ! -d "$ROOT/$app/node_modules" ]; then
    echo "Installing $app dependencies..."
    (cd "$ROOT/$app" && npm install)
  fi
done

# Load backend .env if present (Nest doesn't read it by itself).
if [ -f "$ROOT/backend/.env" ]; then
  set -a; . "$ROOT/backend/.env"; set +a
fi

cleanup() {
  trap - INT TERM EXIT
  echo "Stopping..."
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$ROOT/backend" && npm run start:dev 2>&1 | sed -u 's/^/[backend]  /') &
(cd "$ROOT/frontend" && npm run dev 2>&1 | sed -u 's/^/[frontend] /') &

wait -n
