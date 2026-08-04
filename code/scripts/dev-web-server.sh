#!/usr/bin/env bash
# 一键联调：仅启动 case2 Web + Node 适配服务（不启动打桩）。
# Ctrl+C / SIGTERM 会结束全部子进程。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT/web"
SERVER_DIR="$ROOT/server"
SHARED_DIR="${CASE2_SHARED_DIR:-$ROOT/comdatafiles}"
WEB_PORT="${WEB_PORT:-5173}"
SERVER_HOST="${CASE2_ADAPTER_HOST:-127.0.0.1}"
SERVER_PORT="${CASE2_ADAPTER_PORT:-3102}"

if [[ ! -d "$SHARED_DIR" ]]; then
  echo "[dev-web-server] ERROR: shared dir not found: $SHARED_DIR" >&2
  exit 1
fi
if [[ ! -f "$SHARED_DIR/case_control.json" ]]; then
  echo "[dev-web-server] ERROR: missing control file: $SHARED_DIR/case_control.json" >&2
  exit 1
fi
if [[ ! -d "$WEB_DIR" || ! -d "$SERVER_DIR" ]]; then
  echo "[dev-web-server] ERROR: expected $WEB_DIR and $SERVER_DIR" >&2
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
  echo "[dev-web-server] shutting down..."
  # 先温柔停，再兜底杀进程组孩子
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
  echo "[dev-web-server] stopped"
}

trap cleanup INT TERM EXIT

echo "[dev-web-server] sharedDir=$SHARED_DIR"
echo "[dev-web-server] adapter=http://${SERVER_HOST}:${SERVER_PORT}"
echo "[dev-web-server] web Local=http://127.0.0.1:${WEB_PORT}  (proxy /api -> adapter)"
echo "[dev-web-server] web Network：见下方 Vite 打印的 Network 行（host 已开）"
echo "[dev-web-server] stub is NOT started; run code/back separately if needed"
echo

(
  cd "$SERVER_DIR"
  export CASE2_SHARED_DIR="$SHARED_DIR"
  export CASE2_ADAPTER_HOST="$SERVER_HOST"
  export CASE2_ADAPTER_PORT="$SERVER_PORT"
  npm start
) &
PIDS+=("$!")

(
  cd "$WEB_DIR"
  # vite.config host:true → 打印局域网 IP；允许外部覆盖端口
  npm run dev -- --port "$WEB_PORT"
) &
PIDS+=("$!")

echo "[dev-web-server] pids=${PIDS[*]}"
echo "[dev-web-server] press Ctrl+C to stop both"

# 任一子进程退出则收尾
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[dev-web-server] child $pid exited; stopping the rest"
      exit 1
    fi
  done
  sleep 1
done
