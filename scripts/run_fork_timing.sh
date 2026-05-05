#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f "configs/mainnet_fork.env" ]]; then
  # shellcheck disable=SC1091
  source "configs/mainnet_fork.env"
fi

: "${MAINNET_RPC_URL:?Set MAINNET_RPC_URL in configs/mainnet_fork.env}"
FORK_BLOCK_NUMBER="${FORK_BLOCK_NUMBER:-}"
ANVIL_PORT="${ANVIL_PORT:-8545}"

export PATH="$ROOT_DIR/tools/foundry/bin:$PATH"
if ! command -v anvil >/dev/null 2>&1; then
  echo "anvil not found. Run scripts/install_foundry_local.sh first."
  exit 1
fi

mkdir -p results
ANVIL_LOG="results/anvil.log"
RESULT_JSON="results/fork_timing.json"

anvil_cmd=(anvil --fork-url "$MAINNET_RPC_URL" --port "$ANVIL_PORT" --silent)
if [[ -n "$FORK_BLOCK_NUMBER" ]]; then
  anvil_cmd+=(--fork-block-number "$FORK_BLOCK_NUMBER")
fi
"${anvil_cmd[@]}" >"$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" >/dev/null 2>&1 || true' EXIT

for _ in {1..30}; do
  if curl -s "http://127.0.0.1:${ANVIL_PORT}" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    | rg -q '"result"'; then
    break
  fi
  sleep 0.5
done

python3 - <<'PY'
import json
import os
import time
import urllib.request
from statistics import median

port = int(os.environ.get("ANVIL_PORT", "8545"))
url = f"http://127.0.0.1:{port}"

def rpc(method, params):
    payload = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
    ).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}
    )
    start = time.perf_counter()
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    if "error" in data:
        raise RuntimeError(data["error"])
    return elapsed_ms, data["result"]

def pct(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    idx = int((len(s) - 1) * p)
    return s[idx]

iters = 300
block_ms = []
call_ms = []

for _ in range(iters):
    ms, _ = rpc("eth_blockNumber", [])
    block_ms.append(ms)

# WETH totalSupply() call
weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
data = "0x18160ddd"
for _ in range(iters):
    ms, _ = rpc("eth_call", [{"to": weth, "data": data}, "latest"])
    call_ms.append(ms)

report = {
    "iterations_per_test": iters,
    "eth_blockNumber_ms": {
        "p50": round(median(block_ms), 3),
        "p95": round(pct(block_ms, 0.95), 3),
        "p99": round(pct(block_ms, 0.99), 3),
        "avg": round(sum(block_ms) / len(block_ms), 3),
    },
    "eth_call_weth_totalSupply_ms": {
        "p50": round(median(call_ms), 3),
        "p95": round(pct(call_ms, 0.95), 3),
        "p99": round(pct(call_ms, 0.99), 3),
        "avg": round(sum(call_ms) / len(call_ms), 3),
    },
}

os.makedirs("results", exist_ok=True)
with open("results/fork_timing.json", "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

print(json.dumps(report, indent=2))
PY

echo "Saved timing report to $RESULT_JSON"
