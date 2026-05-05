# Low-Latency Production Target Spec

## Objective

Run a flash-loan arbitrage stack with low decision latency, high RPC resilience, and auditable execution.

## Target Environment

- Cloud: AWS
- Primary region (US): `us-east-1` (lowest average latency to major Ethereum infra from US East)
- Secondary region: `us-west-2` (failover)
- Workload type: containerized microservices on ECS Fargate or EKS

## SLOs

- Quote refresh loop: p95 `< 30ms`
- Opportunity-to-signed-tx: p95 `< 40ms`
- RPC round-trip to primary provider: p95 `< 25ms`
- Submission success (first attempt): `> 99.5%`

## Runtime Topology

1. `strategy-engine` (stateless)
- 2 replicas, active-active
- CPU-optimized nodes
- In-memory opportunity graph and route cache

2. `mempool-ingestor`
- 2 replicas
- WebSocket subscriptions to at least 2 RPC providers
- Deduplicates tx hashes to Redis

3. `tx-executor`
- 2 replicas
- Private tx submission + fallback public mempool
- Strict nonce manager backed by Redis lock

4. `risk-guard`
- 2 replicas
- Enforces hard limits: max notional, max slippage, max gas per tx, kill switch

5. `state-cache` (Redis)
- Multi-AZ, in-transit + at-rest encryption
- Stores ephemeral route states, nonces, idempotency keys

6. `timeseries + logs`
- Prometheus/Grafana + CloudWatch/OpenSearch
- Full trace IDs on quote->decision->tx lifecycle

## Compute Sizing (Initial)

- `strategy-engine`: 2 x `c7g.xlarge` (4 vCPU / 8 GB)
- `mempool-ingestor`: 2 x `c7g.large` (2 vCPU / 4 GB)
- `tx-executor`: 2 x `c7g.large`
- `risk-guard`: 2 x `c7g.medium`
- Redis: `cache.r7g.large` (Multi-AZ)

Scale trigger:

- If quote loop p95 exceeds 30ms for 5m, increase `strategy-engine` replicas by +1.

## Network and RPC

- Minimum 3 RPC providers:
  - Provider A: primary low-latency
  - Provider B: independent backup
  - Provider C: archive-capable for simulation and backfill
- Use smart routing:
  - Read calls: race first response (`hedged requests`) with cancellation
  - Write calls: private relay first, public fallback
- Keep long-lived HTTP/2 and WS connections warm.

## Submission Strategy

- Primary: private orderflow / builder relay submission
- Secondary: public mempool with gas escalator policy
- Re-broadcast policy at +250ms and +700ms if not included

## Security Controls

- Signer isolation:
  - Use AWS KMS or dedicated HSM-backed signer service
  - Never expose raw private key to strategy pods
- Secrets in AWS Secrets Manager only
- Per-service IAM roles (least privilege)
- Mandatory allowlist for executor destinations (contract addresses)
- Runtime policy:
  - kill switch endpoint with MFA-backed access
  - max drawdown circuit breaker

## Observability and Audit

- Log every decision with:
  - candidate route
  - expected EV
  - assumed slippage/gas
  - final tx hash / result
- Persist immutable audit stream to S3 with object lock.
- Alerting:
  - RPC p95 spike
  - failed tx burst
  - nonce conflicts
  - negative EV executions

## DR and Failover

- Warm standby in `us-west-2`
- RTO `< 5 minutes`, RPO `< 30 seconds`
- Weekly failover drill with synthetic load

## Go-Live Gate

1. Backtest + shadow mode minimum 2 weeks
2. No critical alert violations for 7 consecutive days
3. External smart contract and infra security review completed
