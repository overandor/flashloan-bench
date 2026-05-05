#!/usr/bin/env python3
"""Safe fork-only GitHub flash-loan bot evaluator.

- Discovers up to N repositories from GitHub with:
  - stars >= 100
  - pushed in last 24 months
- Clones repos into /Users/alep/Documents/flashloan-bench/github_scan
- Builds dependencies in isolated repo folders
- Runs only local fork tests against an Anvil mainnet fork
- Never executes live trade scripts, never uses withdrawal keys
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import textwrap
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path("/Users/alep/Documents/flashloan-bench")
SCAN_DIR = ROOT / "github_scan"
RESULTS_DIR = ROOT / "results"
RESULTS_FILE = RESULTS_DIR / "github-bot-scan.md"
DISCOVERY_FILE = RESULTS_DIR / "github-bot-discovery.json"
RAW_RESULTS_FILE = RESULTS_DIR / "github-bot-scan.json"

LOCAL_FORK_URL = os.environ.get("LOCAL_FORK_URL", "http://127.0.0.1:8545")
MAX_REPOS_DEFAULT = 15
MIN_STARS_DEFAULT = 100
LOOKBACK_DAYS = 730

# Discovery queries are intentionally broader; hard filters are still applied.
BASE_QUERIES = [
    "flash loan arbitrage bot",
    "flashloan arbitrage",
    "aave flashloan hardhat",
    "mev arbitrage bot solidity",
    "defi arbitrage foundry",
]


@dataclass
class RepoMeta:
    full_name: str
    clone_url: str
    html_url: str
    description: str
    stars: int
    pushed_at: str
    language: str | None


@dataclass
class ScanResult:
    repo: str
    full_name: str
    url: str
    stars: int
    pushed_at: str
    framework: str
    clone_status: str
    build_status: str
    build_message: str
    test_status: str
    test_type: str
    runtime_errors: str
    red_flags: List[str]


def run_cmd(
    cmd: List[str],
    cwd: Path | None = None,
    timeout: int = 300,
    env: Dict[str, str] | None = None,
) -> Tuple[int, str]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
    except FileNotFoundError as exc:
        return 127, f"Command not found: {cmd[0]} ({exc})"

    output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    return proc.returncode, output


def tail_text(s: str, n: int = 1400) -> str:
    return s[-n:] if len(s) > n else s


def gh_request(url: str, token: str | None = None) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "flashloan-fork-scan",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = resp.read().decode("utf-8")
    return json.loads(payload)


def discover_repos(max_repos: int, min_stars: int) -> List[RepoMeta]:
    token = os.environ.get("GITHUB_TOKEN")
    since_date = (dt.date.today() - dt.timedelta(days=LOOKBACK_DAYS)).isoformat()
    repos: Dict[str, RepoMeta] = {}

    for base in BASE_QUERIES:
        q = f"{base} stars:>={min_stars} pushed:>={since_date} archived:false"
        query = urllib.parse.quote(q)
        url = (
            "https://api.github.com/search/repositories"
            f"?q={query}&sort=updated&order=desc&per_page=50"
        )
        try:
            data = gh_request(url, token=token)
        except Exception:
            continue

        for item in data.get("items", []):
            full_name = item.get("full_name")
            if not full_name or item.get("fork"):
                continue

            stars = int(item.get("stargazers_count") or 0)
            pushed_at = item.get("pushed_at") or ""
            if stars < min_stars:
                continue
            if pushed_at and pushed_at[:10] < since_date:
                continue

            repos[full_name] = RepoMeta(
                full_name=full_name,
                clone_url=item.get("clone_url", ""),
                html_url=item.get("html_url", ""),
                description=(item.get("description") or "").strip(),
                stars=stars,
                pushed_at=pushed_at,
                language=item.get("language"),
            )

    ordered = sorted(
        repos.values(),
        key=lambda r: (r.stars, r.pushed_at),
        reverse=True,
    )
    return ordered[:max_repos]


def repo_dir_name(meta: RepoMeta) -> str:
    return meta.full_name.replace("/", "__")


def clone_repo(meta: RepoMeta) -> Tuple[str, Path, str]:
    target = SCAN_DIR / repo_dir_name(meta)
    if target.exists():
        return "Success", target, "Already present"

    code, out = run_cmd(
        ["git", "clone", "--depth", "1", meta.clone_url, str(target)],
        timeout=240,
    )
    if code == 0:
        return "Success", target, "Cloned"
    return "Failed", target, tail_text(out)


def detect_framework(path: Path) -> str:
    if (path / "foundry.toml").exists():
        return "foundry"

    hardhat_configs = [
        path / "hardhat.config.js",
        path / "hardhat.config.ts",
        path / "hardhat.config.cjs",
        path / "hardhat.config.mjs",
    ]
    if any(p.exists() for p in hardhat_configs):
        return "hardhat"

    pkg = path / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            deps = {
                **(data.get("dependencies") or {}),
                **(data.get("devDependencies") or {}),
            }
            if "hardhat" in deps:
                return "hardhat"
        except Exception:
            pass

    return "unknown"


def install_and_build(path: Path, framework: str) -> Tuple[str, str]:
    if framework == "foundry":
        # Build first, then attempt install only if needed.
        code, out = run_cmd(["forge", "build"], cwd=path, timeout=420)
        if code == 0:
            return "Success", "forge build passed"

        if "No such file or directory" in out or "could not find" in out.lower() or "missing" in out.lower():
            run_cmd(["forge", "install", "--no-commit"], cwd=path, timeout=420)
            code2, out2 = run_cmd(["forge", "build"], cwd=path, timeout=420)
            if code2 == 0:
                return "Success", "forge install + build passed"
            return "Failed", tail_text(out2)

        return "Failed", tail_text(out)

    if framework == "hardhat":
        npm = shutil.which("npm")
        if not npm:
            return "Failed", "npm not found"

        install_cmd = [npm, "install", "--ignore-scripts", "--no-audit", "--no-fund"]
        code, out = run_cmd(install_cmd, cwd=path, timeout=540)
        if code != 0:
            return "Failed", tail_text(out)

        compile_cmd = ["npx", "hardhat", "compile"]
        code2, out2 = run_cmd(compile_cmd, cwd=path, timeout=420)
        if code2 == 0:
            return "Success", "npm install + hardhat compile passed"
        return "Failed", tail_text(out2)

    return "Skipped", "Unsupported framework (not Foundry/Hardhat)"


def test_env() -> Dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "MAINNET_RPC_URL": LOCAL_FORK_URL,
            "ETH_RPC_URL": LOCAL_FORK_URL,
            "RPC_URL": LOCAL_FORK_URL,
            "FORK_URL": LOCAL_FORK_URL,
            "ALCHEMY_URL": LOCAL_FORK_URL,
            "INFURA_URL": LOCAL_FORK_URL,
            "WEB3_PROVIDER_URI": LOCAL_FORK_URL,
            "PRIVATE_KEY": "0x" + "11" * 32,
            "MNEMONIC": "test test test test test test test test test test test junk",
            "HARDHAT_NETWORK": "localhost",
            "NODE_ENV": "test",
        }
    )
    return env


def run_fork_tests(path: Path, framework: str) -> Tuple[str, str, str]:
    env = test_env()

    if framework == "foundry":
        # Enforce local fork target.
        cmd = ["forge", "test", "--fork-url", LOCAL_FORK_URL, "-vv"]
        code, out = run_cmd(cmd, cwd=path, timeout=480, env=env)
        return (
            "Success" if code == 0 else "Failed",
            "Foundry local Anvil fork test",
            tail_text(out),
        )

    if framework == "hardhat":
        # Prefer localhost/anvil to ensure local-only execution.
        cmd_localhost = ["npx", "hardhat", "test", "--network", "localhost"]
        code, out = run_cmd(cmd_localhost, cwd=path, timeout=480, env=env)
        if code == 0:
            return "Success", "Hardhat localhost (Anvil fork) test", tail_text(out)

        # Fallback to hardhat network for projects that don't define localhost.
        cmd_hardhat = ["npx", "hardhat", "test", "--network", "hardhat"]
        code2, out2 = run_cmd(cmd_hardhat, cwd=path, timeout=480, env=env)
        if code2 == 0:
            return "Success", "Hardhat test (local hardhat network)", tail_text(out2)

        return "Failed", "Hardhat fork/local test", tail_text(out2)

    return "Skipped", "No supported test runner", "N/A"


def scan_red_flags(path: Path) -> List[str]:
    flags: List[str] = []
    patterns = {
        r"private[_-]?key\s*[:=]\s*['\"][0-9a-fA-Fx]{20,}": "Hardcoded private key",
        r"mnemonic\s*[:=]\s*['\"]": "Mnemonic usage in code",
        r"api[_-]?secret\s*[:=]": "Hardcoded API secret pattern",
        r"--network\s+mainnet": "Explicit mainnet execution command",
        r"broadcast": "Broadcast-related code path",
    }

    exts = {".js", ".ts", ".sol", ".py", ".env", ".md", ".sh"}
    for p in path.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in exts:
            continue
        # Skip heavy deps/vendor dirs
        if any(part in {"node_modules", "lib", ".git", "target", "dist", "build"} for part in p.parts):
            continue
        try:
            txt = p.read_text(errors="ignore")
        except Exception:
            continue

        for pat, label in patterns.items():
            if re.search(pat, txt, flags=re.IGNORECASE):
                flags.append(f"{label} in {p.relative_to(path)}")

    # Deduplicate while preserving order.
    seen = set()
    dedup = []
    for f in flags:
        if f not in seen:
            dedup.append(f)
            seen.add(f)
    return dedup


def rank_runnable(results: List[ScanResult]) -> List[ScanResult]:
    candidates = [
        r
        for r in results
        if r.clone_status == "Success"
        and r.build_status == "Success"
        and r.test_status == "Success"
    ]
    return sorted(candidates, key=lambda r: (r.stars, -len(r.red_flags)), reverse=True)


def generate_markdown(results: List[ScanResult], discovered: List[RepoMeta]) -> str:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    top3 = rank_runnable(results)[:3]

    lines: List[str] = []
    lines.append("# GitHub Flash-Loan Bot SAFE Fork-Only Evaluation")
    lines.append("")
    lines.append(f"Generated: {now}")
    lines.append("")
    lines.append("## Safety Constraints Enforced")
    lines.append("- Fork-only testing on local node (`anvil` / `hardhat` local network)")
    lines.append("- No live trade script execution")
    lines.append("- No withdrawal keys used")
    lines.append("- No mainnet transaction broadcasting")
    lines.append("")
    lines.append("## Discovery Criteria")
    lines.append("- Updated in last 24 months")
    lines.append("- Stars >= 100")
    lines.append(f"- Selected repos: {len(discovered)} (max target: 15)")
    lines.append("")

    lines.append("## Summary Table")
    lines.append("")
    lines.append("| Repo | Stars | Pushed At | Framework | Clone | Build | Test | Red Flags |")
    lines.append("|---|---:|---|---|---|---|---|---:|")
    for r in results:
        lines.append(
            "| "
            f"[{r.full_name}]({r.url}) | {r.stars} | {r.pushed_at[:10]} | {r.framework} | "
            f"{r.clone_status} | {r.build_status} | {r.test_status} | {len(r.red_flags)} |"
        )

    lines.append("")
    lines.append("## Per-Repo Findings")
    for r in results:
        lines.append("")
        lines.append(f"### {r.full_name}")
        lines.append(f"- URL: {r.url}")
        lines.append(f"- Stars: {r.stars}")
        lines.append(f"- Pushed At: {r.pushed_at}")
        lines.append(f"- Framework: {r.framework}")
        lines.append(f"- Build Status: {r.build_status}")
        lines.append(f"- Build Note: {r.build_message}")
        lines.append(f"- Test Status: {r.test_status}")
        lines.append(f"- Test Type: {r.test_type}")
        if r.runtime_errors and r.runtime_errors != "N/A":
            lines.append("- Runtime Errors / Tail Output:")
            lines.append("```text")
            lines.append(r.runtime_errors)
            lines.append("```")
        if r.red_flags:
            lines.append(f"- Red Flags ({len(r.red_flags)}):")
            for flag in r.red_flags[:20]:
                lines.append(f"  - {flag}")
        else:
            lines.append("- Red Flags: none detected")

    lines.append("")
    lines.append("## Top 3 Actually Runnable Repos")
    if top3:
        for i, r in enumerate(top3, 1):
            lines.append(
                f"{i}. [{r.full_name}]({r.url}) - framework: {r.framework}, stars: {r.stars}, flags: {len(r.red_flags)}"
            )
    else:
        lines.append("No repo met clone+build+test success in this run.")

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="SAFE fork-only flash-loan repo scan")
    parser.add_argument("--max-repos", type=int, default=MAX_REPOS_DEFAULT)
    parser.add_argument("--min-stars", type=int, default=MIN_STARS_DEFAULT)
    parser.add_argument("--reuse-clones", action="store_true", help="Reuse existing cloned repos")
    args = parser.parse_args()

    SCAN_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    discovered = discover_repos(max_repos=args.max_repos, min_stars=args.min_stars)
    DISCOVERY_FILE.write_text(
        json.dumps([r.__dict__ for r in discovered], indent=2),
        encoding="utf-8",
    )

    results: List[ScanResult] = []
    for meta in discovered:
        print(f"\\n=== Scanning {meta.full_name} ===")
        clone_status, path, clone_msg = clone_repo(meta)
        framework = detect_framework(path) if clone_status == "Success" else "unknown"

        if clone_status != "Success":
            results.append(
                ScanResult(
                    repo=repo_dir_name(meta),
                    full_name=meta.full_name,
                    url=meta.html_url,
                    stars=meta.stars,
                    pushed_at=meta.pushed_at,
                    framework=framework,
                    clone_status=clone_status,
                    build_status="Skipped",
                    build_message=clone_msg,
                    test_status="Skipped",
                    test_type="N/A",
                    runtime_errors="N/A",
                    red_flags=["Clone failed"],
                )
            )
            continue

        build_status, build_msg = install_and_build(path, framework)

        if build_status == "Success":
            test_status, test_type, runtime_tail = run_fork_tests(path, framework)
        else:
            test_status, test_type, runtime_tail = ("Skipped", "N/A", "N/A")

        flags = scan_red_flags(path)

        results.append(
            ScanResult(
                repo=repo_dir_name(meta),
                full_name=meta.full_name,
                url=meta.html_url,
                stars=meta.stars,
                pushed_at=meta.pushed_at,
                framework=framework,
                clone_status=clone_status,
                build_status=build_status,
                build_message=build_msg,
                test_status=test_status,
                test_type=test_type,
                runtime_errors=runtime_tail,
                red_flags=flags,
            )
        )

    RAW_RESULTS_FILE.write_text(
        json.dumps([r.__dict__ for r in results], indent=2),
        encoding="utf-8",
    )

    md = generate_markdown(results, discovered)
    RESULTS_FILE.write_text(md, encoding="utf-8")

    ok = len([r for r in results if r.clone_status == "Success" and r.build_status == "Success" and r.test_status == "Success"])
    print("\\nScan complete")
    print(f"Discovered: {len(discovered)}")
    print(f"Runnable (clone+build+test): {ok}")
    print(f"Report: {RESULTS_FILE}")


if __name__ == "__main__":
    main()
