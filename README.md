# Flash-Loan Benchmark & Berachain-Solana Native Bridge

This repository contains two main components:

1. **Berachain-Solana Native Bridge** - A production-grade native bridge between Berachain and Solana using lock/mint and burn/release with validator quorum signatures
2. **Flash-Loan Compute Benchmark Kit** - Local toolkit to profile flash-loan strategy compute and run mainnet-fork timing tests

## Berachain-Solana Bridge

**Status:** Prototype under active hardening. Not yet production-safe.

**Supports:**
- ERC-20 tokens (Berachain) ↔ SPL tokens (Solana)
- Native SOL → Native BERA

**Documentation:** See [bridge/README.md](bridge/README.md) for architecture, deployment, and usage.

**⚠️ Security Note:** The bridge is currently in prototype phase. Critical hardening (tests, CI, real event decoding) is in progress on the `harden-bridge-ci` branch. Do not use with real value until tests pass and audit is complete.

## Flash-Loan Benchmark Kit

Local toolkit to profile flash-loan strategy compute and run mainnet-fork timing tests with Foundry/Anvil.

### What It Includes

- `bench/harness.py`: profit + gas + slippage + execution-probability scoring.
- `scripts/run_benchmark.sh`: repeatable throughput benchmark run.
- `scripts/install_foundry_local.sh`: local Foundry install into `tools/foundry/bin`.
- `scripts/run_fork_timing.sh`: Anvil mainnet-fork latency test (JSON-RPC p50/p95/p99).
- `configs/mainnet_fork.env.example`: fork config template.
- `results/*.json`: generated benchmark artifacts.

### Quick Start

```bash
cd /Users/alep/Documents/flashloan-bench

# 1) Run local compute benchmark
./scripts/run_benchmark.sh

# 2) Install Foundry locally (forge/anvil/cast)
./scripts/install_foundry_local.sh

# 3) Run fork timing test against a working RPC
MAINNET_RPC_URL=https://ethereum.publicnode.com ./scripts/run_fork_timing.sh
```

### Current Results (This Machine)

- Strategy-evaluation throughput: `~2.89M evals/sec` (Python harness)
- Anvil fork timing (`ethereum.publicnode.com`, 300 samples each):
  - `eth_blockNumber`: p50 `0.311ms`, p95 `0.499ms`, p99 `0.892ms`
  - `eth_call` (WETH `totalSupply`): p50 `0.452ms`, p95 `0.738ms`, p99 `0.920ms`

Result files:

- `results/benchmark.json`
- `results/fork_timing.json`

### Notes

- For realistic production forecasting, replace `MAINNET_RPC_URL` with your paid low-latency RPC provider.
- If you need deterministic replay, set `FORK_BLOCK_NUMBER` in `configs/mainnet_fork.env`.
