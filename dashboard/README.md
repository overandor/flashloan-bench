# Benchmark & Bridge Status Dashboard

Real-time dashboard for flash-loan benchmark results and bridge deployment status.

## Features

- **Benchmark Results**: Displays throughput and RPC latency metrics from `results/*.json`
- **Bridge Status**: Shows deployment status, supported transfers, and security documentation
- **CI Status**: Links to GitHub Actions workflows and coverage
- **Release Info**: Fetches latest release information from GitHub API

## No Fake Data

This dashboard reads only real data:
- Benchmark results from `results/benchmark.json` and `results/fork_timing.json`
- Deployment status from `docs/TESTNET_DEMO.md`
- CI status from GitHub Actions
- Release metadata from GitHub Releases API

No simulated transfers, no fake TVL, no mock data.

## Running Locally

```bash
cd dashboard
pip install -r requirements.txt
streamlit run app.py
```

The dashboard will open at http://localhost:8501

## Deployment

### Streamlit Cloud

1. Push code to GitHub
2. Go to https://share.streamlit.io
3. Connect your GitHub repository
4. Configure:
   - Main file path: `dashboard/app.py`
   - Python version: 3.11
5. Deploy

### Alternative: Static HTML

Generate static HTML and deploy to GitHub Pages (requires additional setup).

## Data Requirements

For the dashboard to show data:

- Run benchmark: `./scripts/run_benchmark.sh` (from repo root)
- Run fork timing: `MAINNET_RPC_URL=https://... ./scripts/run_fork_timing.sh`
- Deploy bridge to testnet (see `docs/TESTNET_DEMO.md`)
- Ensure GitHub Actions CI is enabled

## Screenshots

Add screenshots here after deployment.
