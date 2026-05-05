#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python3 bench/harness.py \
  --opportunities configs/opportunities.sample.json \
  --principal-usd 250000 \
  --flash-loan-fee-bps 9 \
  --gas-price-gwei 16 \
  --eth-usd 3200 \
  --iterations 2000000 \
  --top 6 \
  --out results/benchmark.json
