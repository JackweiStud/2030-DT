#!/usr/bin/env bash
# Playwright E2E stack for case4:
# - 独立临时共享根，不占用用户联调目录、不改参考资料
# - 启动 Node 适配 + case4 stub + Vite
# - 退出时清理本脚本拉起的进程
# Node 若尚未提供 /api/case4，适配探活仍会成功（进程起来），但业务请求会 404。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT/web"
SERVER_DIR="$ROOT/server"
BACK_DIR="$ROOT/back"
STUB_DIR="$ROOT/back/case4"
BACK_ENV="$BACK_DIR/.env"
BACK_ENV_BACKUP="$ROOT/.tmp/case4-e2e-back-env.$$"
BACK_ENV_HAD_FILE=0
BACK_ENV_TOUCHED=0
SHARED_DIR="${CASE4_E2E_SHARED_DIR:-$ROOT/.tmp/case4-e2e-shared}"
WEB_PORT="${CASE4_E2E_WEB_PORT:-55174}"
ADAPTER_HOST="${CASE4_E2E_ADAPTER_HOST:-127.0.0.1}"
ADAPTER_PORT="${CASE4_E2E_ADAPTER_PORT:-33104}"
STUB_STEP_MS="${CASE4_E2E_STUB_STEP_MS:-400}"
STUB_POLL_MS="${CASE4_E2E_STUB_POLL_MS:-200}"
STUB_SUCCESS_DWELL_MS="${CASE4_E2E_STUB_SUCCESS_DWELL_MS:-3000}"
STUB_DATA_MODE="${CASE4_E2E_STUB_DATA_MODE:-random}"

if [[ "$SHARED_DIR" != "$ROOT/.tmp/"* && "${CASE4_E2E_ALLOW_EXTERNAL_SHARED_DIR:-0}" != "1" ]]; then
  echo "[case4-e2e] ERROR: refusing to reset shared dir outside $ROOT/.tmp: $SHARED_DIR" >&2
  exit 1
fi
if [[ "$SHARED_DIR" == "/" || -z "$SHARED_DIR" ]]; then
  echo "[case4-e2e] ERROR: invalid shared dir: $SHARED_DIR" >&2
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
  echo "[case4-e2e] shutting down..."
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
  if [[ "$BACK_ENV_TOUCHED" -eq 1 ]]; then
    if [[ "$BACK_ENV_HAD_FILE" -eq 1 && -f "$BACK_ENV_BACKUP" ]]; then
      mv "$BACK_ENV_BACKUP" "$BACK_ENV"
    else
      rm -f "$BACK_ENV"
    fi
  fi
  echo "[case4-e2e] stopped"
}

trap cleanup INT TERM EXIT

echo "[case4-e2e] preparing sharedDir=$SHARED_DIR"
rm -rf "$SHARED_DIR"
mkdir -p "$SHARED_DIR/case4" "$SHARED_DIR/out/case4" "$ROOT/.tmp"
node -e 'const fs=require("fs"); const p=process.argv[1]; fs.writeFileSync(p, JSON.stringify({case:"case4",command:"init",dt_type:"",status:"",save_picture_flag:0}, null, 2) + "\n");' "$SHARED_DIR/case_control.json"

if [[ -f "$BACK_ENV" ]]; then
  cp "$BACK_ENV" "$BACK_ENV_BACKUP"
  BACK_ENV_HAD_FILE=1
fi
BACK_ENV_TOUCHED=1
cat > "$BACK_ENV" <<EOF
DT_SHARED_DIR=$SHARED_DIR
CASE4_STUB_LOG_LEVEL=info
CASE4_STUB_STEP_MS=$STUB_STEP_MS
CASE4_STUB_POLL_MS=$STUB_POLL_MS
CASE4_STUB_SUCCESS_DWELL_MS=$STUB_SUCCESS_DWELL_MS
CASE4_STUB_REQUEST_PICTURE=1
CASE4_STUB_DATA_MODE=$STUB_DATA_MODE
CASE4_STUB_SEED=case4-e2e
CASE4_STUB_SEED_INIT=1
EOF

(
  cd "$SERVER_DIR"
  export DT_SHARED_DIR="$SHARED_DIR"
  export DT_ADAPTER_HOST="$ADAPTER_HOST"
  export DT_ADAPTER_PORT="$ADAPTER_PORT"
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
    if (res.status > 0) process.exit(0);
  } catch {}
  if (Date.now() > deadline) process.exit(1);
  setTimeout(once, 200);
}
once();
' "http://${ADAPTER_HOST}:${ADAPTER_PORT}/api/case4/control-file"

CASE4_PROBE=$(node -e '
fetch(process.argv[1]).then(async (res) => {
  const body = await res.text();
  process.stdout.write(String(res.status) + " " + body.slice(0, 120));
}).catch((err) => {
  process.stdout.write("error " + err.message);
  process.exitCode = 1;
});
' "http://${ADAPTER_HOST}:${ADAPTER_PORT}/api/case4/control-file" || true)
echo "[case4-e2e] adapter probe: $CASE4_PROBE"
if [[ "$CASE4_PROBE" == 404* ]]; then
  echo "[case4-e2e] WARNING: Node 尚未提供 /api/case4，三进程主线会失败；前端隔离 Playwright 仍可用默认 test:e2e。" >&2
fi

(
  cd "$STUB_DIR"
  npm start
) &
PIDS+=("$!")

(
  cd "$WEB_DIR"
  export DT_ADAPTER_HOST="$ADAPTER_HOST"
  export DT_ADAPTER_PORT="$ADAPTER_PORT"
  export CASE2_ADAPTER_HOST="$ADAPTER_HOST"
  export CASE2_ADAPTER_PORT="$ADAPTER_PORT"
  export CASE4_REFLECTION_ENABLE=true
  export CASE4_BS_XYZ="(1.0,5.0,7.0)"
  npm run dev -- --host 127.0.0.1 --port "$WEB_PORT"
) &
PIDS+=("$!")

echo "[case4-e2e] adapter=http://${ADAPTER_HOST}:${ADAPTER_PORT}"
echo "[case4-e2e] web=http://127.0.0.1:${WEB_PORT}"
echo "[case4-e2e] pids=${PIDS[*]}"

while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[case4-e2e] child $pid exited; stopping the rest"
      exit 1
    fi
  done
  sleep 1
done
