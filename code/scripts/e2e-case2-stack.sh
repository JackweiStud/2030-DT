#!/usr/bin/env bash
# Playwright E2E stack for case2:
# - prepares an isolated shared directory
# - starts Node adapter + local stub backend + Vite
# - stops all child processes on Ctrl+C / SIGTERM / Playwright shutdown
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT/web"
SERVER_DIR="$ROOT/server"
STUB_DIR="$ROOT/back/case2"
FIXTURE_DIR="$STUB_DIR/back"
SHARED_DIR="${CASE2_E2E_SHARED_DIR:-$ROOT/.tmp/case2-e2e-shared}"
WEB_PORT="${CASE2_E2E_WEB_PORT:-55173}"
ADAPTER_HOST="${CASE2_E2E_ADAPTER_HOST:-127.0.0.1}"
ADAPTER_PORT="${CASE2_E2E_ADAPTER_PORT:-33102}"
STUB_STEP_MS="${CASE2_E2E_STUB_STEP_MS:-1000}"
STUB_POLL_MS="${CASE2_E2E_STUB_POLL_MS:-250}"

if [[ "$SHARED_DIR" != "$ROOT/.tmp/"* && "${CASE2_E2E_ALLOW_EXTERNAL_SHARED_DIR:-0}" != "1" ]]; then
  echo "[case2-e2e] ERROR: refusing to reset shared dir outside $ROOT/.tmp: $SHARED_DIR" >&2
  exit 1
fi
if [[ "$SHARED_DIR" == "/" || -z "$SHARED_DIR" ]]; then
  echo "[case2-e2e] ERROR: invalid shared dir: $SHARED_DIR" >&2
  exit 1
fi

PIDS=()
CLEANED=0

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then
    return
  fi
  CLEANED=1
  echo
  echo "[case2-e2e] shutting down..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 0.4
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "[case2-e2e] stopped"
}

trap cleanup INT TERM EXIT

echo "[case2-e2e] preparing sharedDir=$SHARED_DIR"
rm -rf "$SHARED_DIR"
mkdir -p "$SHARED_DIR/case2" "$SHARED_DIR/out/case2"
cp "$FIXTURE_DIR"/heatmap_init_*.txt "$SHARED_DIR/case2/"
node -e 'const fs=require("fs"); const p=process.argv[1]; fs.writeFileSync(p, JSON.stringify({case:"case2",command:"init",dt_type:"with dt",status:"",save_picture_flag:0}, null, 2) + "\n");' "$SHARED_DIR/case_control.json"

(
  cd "$SERVER_DIR"
  export CASE2_SHARED_DIR="$SHARED_DIR"
  export CASE2_ADAPTER_HOST="$ADAPTER_HOST"
  export CASE2_ADAPTER_PORT="$ADAPTER_PORT"
  npm start
) &
PIDS+=("$!")

node -e '
const url = process.argv[1];
const deadline = Date.now() + 15000;
async function once() {
  try {
    const res = await fetch(url);
    if (res.ok) process.exit(0);
  } catch {}
  if (Date.now() > deadline) process.exit(1);
  setTimeout(once, 200);
}
once();
' "http://${ADAPTER_HOST}:${ADAPTER_PORT}/api/case2/control-file"

(
  cd "$STUB_DIR"
  export CASE2_SHARED_DIR="$SHARED_DIR"
  export CASE2_STUB_LOG_LEVEL="${CASE2_STUB_LOG_LEVEL:-info}"
  export CASE2_STUB_STEP_MS="$STUB_STEP_MS"
  export CASE2_STUB_POLL_MS="$STUB_POLL_MS"
  export CASE2_STUB_REQUEST_PICTURE="${CASE2_STUB_REQUEST_PICTURE:-1}"
  export CASE2_STUB_DATA_MODE="${CASE2_STUB_DATA_MODE:-random}"
  export CASE2_STUB_SEED="${CASE2_STUB_SEED:-case2-e2e}"
  npm start
) &
PIDS+=("$!")

(
  cd "$WEB_DIR"
  export CASE2_ADAPTER_HOST="$ADAPTER_HOST"
  export CASE2_ADAPTER_PORT="$ADAPTER_PORT"
  npm run dev -- --host 127.0.0.1 --port "$WEB_PORT"
) &
PIDS+=("$!")

echo "[case2-e2e] adapter=http://${ADAPTER_HOST}:${ADAPTER_PORT}"
echo "[case2-e2e] web=http://127.0.0.1:${WEB_PORT}"
echo "[case2-e2e] pids=${PIDS[*]}"

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[case2-e2e] child $pid exited; stopping the rest"
      exit 1
    fi
  done
  sleep 1
done
