#!/usr/bin/env python3
"""Flash-loan strategy benchmark harness.

This tool estimates net profitability per opportunity and measures local compute
throughput for scanning routes.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence


@dataclass
class Opportunity:
    route: str
    edge_bps: float
    slippage_bps: float
    gas_units: int
    success_prob: float
    max_notional_usd: float


def load_opportunities(path: Path) -> List[Opportunity]:
    raw = json.loads(path.read_text())
    opportunities: List[Opportunity] = []
    for row in raw:
        opportunities.append(
            Opportunity(
                route=row["route"],
                edge_bps=float(row["edge_bps"]),
                slippage_bps=float(row["slippage_bps"]),
                gas_units=int(row["gas_units"]),
                success_prob=float(row["success_prob"]),
                max_notional_usd=float(row["max_notional_usd"]),
            )
        )
    return opportunities


def profit_usd(
    *,
    principal_usd: float,
    edge_bps: float,
    flash_loan_fee_bps: float,
    slippage_bps: float,
    gas_units: int,
    gas_price_gwei: float,
    eth_usd: float,
) -> float:
    gross = principal_usd * (edge_bps / 10_000.0)
    borrow_fee = principal_usd * (flash_loan_fee_bps / 10_000.0)
    slippage_cost = principal_usd * (slippage_bps / 10_000.0)
    gas_cost = gas_units * gas_price_gwei * 1e-9 * eth_usd
    return gross - borrow_fee - slippage_cost - gas_cost


def score_opportunity(
    opp: Opportunity,
    *,
    principal_usd: float,
    flash_loan_fee_bps: float,
    gas_price_gwei: float,
    eth_usd: float,
) -> dict:
    notional = min(principal_usd, opp.max_notional_usd)
    net = profit_usd(
        principal_usd=notional,
        edge_bps=opp.edge_bps,
        flash_loan_fee_bps=flash_loan_fee_bps,
        slippage_bps=opp.slippage_bps,
        gas_units=opp.gas_units,
        gas_price_gwei=gas_price_gwei,
        eth_usd=eth_usd,
    )
    expected_value = net * opp.success_prob
    return {
        "route": opp.route,
        "notional_usd": notional,
        "net_profit_usd": net,
        "expected_value_usd": expected_value,
        "success_prob": opp.success_prob,
    }


def throughput_benchmark(
    opportunities: Sequence[Opportunity],
    *,
    principal_usd: float,
    flash_loan_fee_bps: float,
    gas_price_gwei: float,
    eth_usd: float,
    iterations: int,
) -> dict:
    n = len(opportunities)
    if n == 0:
        raise ValueError("No opportunities loaded")

    random.seed(42)
    values = []
    start = time.perf_counter()
    for i in range(iterations):
        opp = opportunities[i % n]
        out = score_opportunity(
            opp,
            principal_usd=principal_usd,
            flash_loan_fee_bps=flash_loan_fee_bps,
            gas_price_gwei=gas_price_gwei,
            eth_usd=eth_usd,
        )
        # Keep a tiny accumulator to avoid optimizing away useful work.
        values.append(out["expected_value_usd"])
    elapsed = time.perf_counter() - start
    evals_per_sec = iterations / elapsed if elapsed else math.inf
    return {
        "iterations": iterations,
        "seconds": elapsed,
        "evals_per_sec": evals_per_sec,
        "ev_mean_usd": statistics.fmean(values),
        "ev_p95_usd": sorted(values)[int(len(values) * 0.95)],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Flash-loan benchmark harness")
    parser.add_argument(
        "--opportunities",
        type=Path,
        default=Path("configs/opportunities.sample.json"),
    )
    parser.add_argument("--principal-usd", type=float, default=250_000.0)
    parser.add_argument("--flash-loan-fee-bps", type=float, default=9.0)
    parser.add_argument("--gas-price-gwei", type=float, default=16.0)
    parser.add_argument("--eth-usd", type=float, default=3200.0)
    parser.add_argument("--iterations", type=int, default=2_000_000)
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--out", type=Path, default=Path("results/benchmark.json"))
    args = parser.parse_args()

    opportunities = load_opportunities(args.opportunities)

    scored = [
        score_opportunity(
            opp,
            principal_usd=args.principal_usd,
            flash_loan_fee_bps=args.flash_loan_fee_bps,
            gas_price_gwei=args.gas_price_gwei,
            eth_usd=args.eth_usd,
        )
        for opp in opportunities
    ]
    scored.sort(key=lambda x: x["expected_value_usd"], reverse=True)

    bench = throughput_benchmark(
        opportunities,
        principal_usd=args.principal_usd,
        flash_loan_fee_bps=args.flash_loan_fee_bps,
        gas_price_gwei=args.gas_price_gwei,
        eth_usd=args.eth_usd,
        iterations=args.iterations,
    )

    report = {
        "inputs": {
            "principal_usd": args.principal_usd,
            "flash_loan_fee_bps": args.flash_loan_fee_bps,
            "gas_price_gwei": args.gas_price_gwei,
            "eth_usd": args.eth_usd,
            "iterations": args.iterations,
            "opportunities_file": str(args.opportunities),
            "opportunities_count": len(opportunities),
        },
        "top_routes": scored[: args.top],
        "throughput": bench,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
