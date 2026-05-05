#!/usr/bin/env python3
"""
Flash-Loan Benchmark & Bridge Status Dashboard

Real data dashboard that reads from:
- results/*.json (benchmark results)
- docs/TESTNET_DEMO.md (deployment status)
- GitHub Actions CI status
- Release metadata

No simulated data, no fake transfers, no fake TVL.
"""

import streamlit as st
import json
import os
from pathlib import Path
from datetime import datetime
import requests

# Page config
st.set_page_config(
    page_title="Flash-Loan Benchmark & Bridge Status",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .metric-card {
        background: #1e1e1e;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
    }
    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
    }
    .status-prototype {
        background: #f59e0b;
        color: #000;
    }
    .status-not-deployed {
        background: #6b7280;
        color: #fff;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.title("Flash-Loan Benchmark & Bridge Status")
st.markdown("---")

# Repository info
REPO = "overandor/flashloan-bench"
REPO_URL = f"https://github.com/{REPO}"

col1, col2, col3 = st.columns(3)
with col1:
    st.markdown(f"[📦 Repository]({REPO_URL})")
with col2:
    st.markdown(f"[📖 Bridge Docs]({REPO_URL}/blob/main/bridge/README.md)")
with col3:
    st.markdown(f"[🚀 Releases]({REPO_URL}/releases)")

st.markdown("---")

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["Benchmark Results", "Bridge Status", "CI Status", "Release Info"])

# Tab 1: Benchmark Results
with tab1:
    st.header("Flash-Loan Benchmark Results")
    
    results_dir = Path("../results")
    benchmark_file = results_dir / "benchmark.json"
    timing_file = results_dir / "fork_timing.json"
    
    if benchmark_file.exists():
        with open(benchmark_file, 'r') as f:
            benchmark_data = json.load(f)
        
        st.subheader("Throughput Metrics")
        col1, col2, col3 = st.columns(3)
        
        evals_per_sec = benchmark_data.get('evals_per_sec', 0)
        total_evals = benchmark_data.get('total_evals', 0)
        duration = benchmark_data.get('duration', 0)
        
        col1.metric("Evaluations/sec", f"{evals_per_sec:,.0f}")
        col2.metric("Total Evaluations", f"{total_evals:,.0f}")
        col3.metric("Duration (s)", f"{duration:.2f}")
        
        st.info(f"Last benchmark run: {benchmark_data.get('timestamp', 'Unknown')}")
    else:
        st.warning("⚠️ Benchmark results not found. Run `./scripts/run_benchmark.sh` to generate results.")
        st.code("./scripts/run_benchmark.sh", language="bash")
    
    if timing_file.exists():
        with open(timing_file, 'r') as f:
            timing_data = json.load(f)
        
        st.subheader("RPC Latency")
        
        for metric_name, latencies in timing_data.items():
            if isinstance(latencies, list) and latencies:
                sorted_lats = sorted(latencies)
                p50 = sorted_lats[len(sorted_lats) // 2]
                p95 = sorted_lats[int(len(sorted_lats) * 0.95)]
                p99 = sorted_lats[int(len(sorted_lats) * 0.99)]
                
                st.markdown(f"**{metric_name}**")
                col1, col2, col3 = st.columns(3)
                col1.metric("p50", f"{p50:.3f}ms")
                col2.metric("p95", f"{p95:.3f}ms")
                col3.metric("p99", f"{p99:.3f}ms")
    else:
        st.info("ℹ️ Fork timing results not found. Run `MAINNET_RPC_URL=https://... ./scripts/run_fork_timing.sh`")

# Tab 2: Bridge Status
with tab2:
    st.header("Berachain-Solana Bridge Status")
    
    # Status badges
    col1, col2 = st.columns(2)
    with col1:
        st.markdown('<span class="status-badge status-prototype">🔧 PROTOTYPE</span>', unsafe_allow_html=True)
    with col2:
        st.markdown('<span class="status-badge status-not-deployed">⏳ NOT DEPLOYED</span>', unsafe_allow_html=True)
    
    st.warning("""
    **⚠️ PROTOTYPE ONLY - NOT PRODUCTION SAFE**
    
    The bridge is currently in prototype phase. Do not use with real value until:
    - Professional security audit is completed
    - Testnet deployment is verified
    - CI passes visibly on GitHub
    - Real transaction proof is documented
    """)
    
    # Bridge features
    st.subheader("Supported Transfers")
    col1, col2, col3 = st.columns(3)
    col1.info("ERC-20 → SPL")
    col2.info("SPL → ERC-20")
    col3.info("Native SOL → Native BERA")
    
    # Read testnet deployment doc
    testnet_doc = Path("../docs/TESTNET_DEMO.md")
    if testnet_doc.exists():
        with open(testnet_doc, 'r') as f:
            testnet_content = f.read()
        
        st.subheader("Testnet Deployment Status")
        
        # Check for TODO placeholders
        if "[TODO]" in testnet_content:
            st.warning("📋 Testnet deployment planned but not yet executed. See [Testnet Deployment Guide](docs/TESTNET_DEMO.md) for deployment instructions.")
        else:
            st.success("✅ Testnet deployment documentation complete")
    else:
        st.info("📄 Testnet deployment guide available at [docs/TESTNET_DEMO.md](docs/TESTNET_DEMO.md)")
    
    # Transaction proof placeholders
    st.subheader("Transaction Proof")
    st.info("Transaction links will be added after testnet deployment. See [Testnet Deployment Guide](docs/TESTNET_DEMO.md) for deployment steps.")
    
    # Security docs
    st.subheader("Security Documentation")
    col1, col2 = st.columns(2)
    col1.markdown("[🔒 Security Model](docs/SECURITY_MODEL.md)")
    col2.markdown("[⚔️ Threat Model](docs/THREAT_MODEL.md)")

# Tab 3: CI Status
with tab3:
    st.header("GitHub Actions CI Status")
    
    # CI workflows
    workflows = [
        ("Bridge CI", f"{REPO_URL}/actions/workflows/bridge-ci.yml"),
        ("Python Bench CI", f"{REPO_URL}/actions/workflows/python-bench-ci.yml"),
    ]
    
    for name, url in workflows:
        st.markdown(f"**[{name}]({url})**")
    
    st.info("ℹ️ Click workflow names to view CI status on GitHub")
    
    # CI summary
    st.subheader("CI Coverage")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Solidity", "Compile")
    col2.metric("Anchor", "Build")
    col3.metric("TypeScript", "Type Check")
    col4.metric("Python", "Syntax")
    
    st.info("🔍 Secret scanning enabled (TruffleHog)")

# Tab 4: Release Info
with tab4:
    st.header("Release Information")
    
    # Fetch latest release info from GitHub API
    try:
        response = requests.get(f"https://api.github.com/repos/{REPO}/releases/latest", timeout=5)
        if response.status_code == 200:
            release_data = response.json()
            
            st.subheader(f"Latest Release: {release_data.get('name', 'Unknown')}")
            st.markdown(f"**Tag:** `{release_data.get('tag_name', 'Unknown')}`")
            st.markdown(f"**Published:** {release_data.get('published_at', 'Unknown')}")
            st.markdown(f"**Prerelease:** {'Yes' if release_data.get('prerelease') else 'No'}")
            
            release_url = release_data.get('html_url')
            st.markdown(f"[📦 View Release on GitHub]({release_url})")
            
            # Release notes
            body = release_data.get('body', '')
            if body:
                st.subheader("Release Notes")
                st.markdown(body)
        else:
            st.warning("Could not fetch release information from GitHub API")
    except Exception as e:
        st.warning(f"Error fetching release info: {e}")
    
    # Commit info
    st.subheader("Latest Commits")
    st.info(f"View commits on [GitHub]({REPO_URL}/commits/main)")
    
    # Repository stats
    try:
        response = requests.get(f"https://api.github.com/repos/{REPO}", timeout=5)
        if response.status_code == 200:
            repo_data = response.json()
            
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Stars", repo_data.get('stargazers_count', 0))
            col2.metric("Forks", repo_data.get('forks_count', 0))
            col3.metric("Open Issues", repo_data.get('open_issues_count', 0))
            col4.metric("Watchers", repo_data.get('subscribers_count', 0))
    except Exception as e:
        st.warning(f"Error fetching repo stats: {e}")

# Footer
st.markdown("---")
st.markdown("""
**Data Sources:**
- Benchmark results: `results/*.json`
- Deployment status: `docs/TESTNET_DEMO.md`
- CI status: GitHub Actions API
- Release info: GitHub Releases API

**Note:** This dashboard shows real data from the repository. No simulated transfers or fake TVL.
""")
