# Threat Model

## Threat Actors

### 1. Malicious Validators
**Capability:** Can sign release requests
**Motivation:** Steal locked funds
**Attack Vectors:**
- Collude to sign fraudulent release requests
- Sign release requests for non-existent burns
- Exceed threshold to bypass quorum requirements
**Mitigations:**
- Threshold signature requirement (2/3 or higher)
- Geographic and organizational diversity of validators
- Hardware security modules (HSMs) for key storage
- Monitoring and slashing for misbehavior

### 2. Compromised Relayer
**Capability:** Can submit transactions to both chains
**Motivation:** Steal funds, disrupt operations
**Attack Vectors:**
- Submit fraudulent release requests with stolen validator signatures
- Fabricate burn events to trigger releases
- Withhold legitimate release requests
**Mitigations:**
- Relayer dry-run mode for testing
- Strict event parsing (fail closed on parse errors)
- Multiple independent relayers for redundancy
- Monitoring for unusual transaction patterns

### 3. Contract Owner
**Capability:** Can update validators, threshold, token mappings
**Motivation:** Rug pull, change rules maliciously
**Attack Vectors:**
- Add themselves as validators
- Lower threshold to 1
- Change token mappings to malicious addresses
- Upgrade to malicious contract
**Mitigations:**
- Multi-sig ownership
- Time-locked governance
- Transparent governance process
- Community monitoring of changes

### 4. Blockchain Reorgs
**Capability:** Can reorder or revert transactions
**Motivation:** Double-spend, replay attacks
**Attack Vectors:**
- Reorg to replay lock events
- Reorg to revert release transactions
**Mitigations:**
- Finality wait periods before minting
- Chain-specific finality assumptions
- Replay protection with nonces and transfer IDs

### 5. RPC Provider Attacks
**Capability:** Can provide false chain state
**Motivation:** Cause relayer to submit incorrect transactions
**Attack Vectors:**
- Return fake event logs
- Return fake transaction receipts
**Mitigations:**
- Use multiple RPC providers
- Verify data across sources
- Cross-check with block explorers

## Attack Scenarios

### Scenario 1: Validator Collusion
**Description:** Validators collude to sign a fraudulent release request
**Impact:** Loss of locked tokens
**Likelihood:** Medium (depends on validator set composition)
**Mitigation:** High threshold, diverse validator set, monitoring

### Scenario 2: Relayer Compromise
**Description:** Attacker gains access to relayer and validator keys
**Impact:** Can drain all locked tokens
**Likelihood:** Low (requires breaking relayer security)
**Mitigation:** HSMs, key rotation, multi-relayer architecture

### Scenario 3: Replay Attack
**Description:** Attacker replays a past release transaction
**Impact:** Double-spend of released tokens
**Likelihood:** Low (replay protection in place)
**Mitigation:** Nonces, transfer ID tracking, releasedTransfers mapping

### Scenario 4: Token Mapping Manipulation
**Description:** Owner changes token mapping to malicious address
**Impact:** Releases go to wrong address
**Likelihood:** Low (requires owner compromise or malicious owner)
**Mitigation:** Multi-sig ownership, governance delays

### Scenario 5: Threshold Manipulation
**Description:** Owner lowers threshold to 1 validator
**Impact:** Single validator can release funds
**Likelihood:** Low (requires owner compromise)
**Mitigation:** Multi-sig ownership, governance delays, activeValidatorCount check

## Attack Surface

### Berachain Contract
- External calls: `lock()`, `release()`, `setValidator()`, `setValidatorThreshold()`, `setTokenMapping()`, `fundNative()`
- Trust assumptions: Owner, validators, relayer
- Attack surface: Reentrancy (mitigated by SafeERC20), overflow (Solidity 0.8.24), signature replay (mitigated by digest)

### Solana Program
- External calls: `initialize()`, `set_validators()`, `mint_wrapped()`, `burn_wrapped()`, `burn_native()`
- Trust assumptions: Authority, validators
- Attack surface: CPI attacks (mitigated by Anchor), account hijacking (mitigated by constraints)

### Relayer
- External connections: Berachain RPC, Solana RPC
- Trust assumptions: RPC providers, validator keys
- Attack surface: RPC manipulation, key theft, event parsing errors

## Defense in Depth

### Layer 1: Contract-Level
- SafeERC20 for token transfers
- Replay protection with nonces and transfer IDs
- Threshold signature requirements
- Input validation

### Layer 2: Validator-Level
- Diverse validator set
- HSM-protected keys
- Monitoring and slashing
- Key rotation procedures

### Layer 3: Relayer-Level
- Strict event parsing
- Dry-run mode
- Multiple RPC providers
- Monitoring and alerts

### Layer 4: Governance-Level
- Multi-sig ownership
- Time-locked changes
- Transparent governance
- Community oversight

## Incident Response

### Detection
- Monitoring for unusual transaction patterns
- Alerting for threshold changes
- Monitoring for failed releases
- Validator activity monitoring

### Response
- Pause bridge if suspicious activity detected
- Rotate compromised validator keys
- Revert malicious governance changes
- Communicate with community

### Recovery
- Restore from backup if possible
- Compensate affected users (if insurance fund exists)
- Conduct post-incident review
- Update security measures

## Remaining Risks

### High Severity
- Validator collusion (mitigated but not eliminated)
- Owner rug pull (mitigated by multi-sig but centralized)

### Medium Severity
- Relayer downtime (mitigated by multiple relayers)
- RPC provider issues (mitigated by multiple providers)

### Low Severity
- Smart contract bugs (mitigated by audit and testing)
- Reorg attacks (mitigated by finality waits)

## Recommended Audits

1. **Smart Contract Audit** - Berachain contract and Solana program
2. **Relayer Security Audit** - Key management, event parsing, RPC handling
3. **Governance Audit** - Multi-sig setup, governance process
4. **Infrastructure Audit** - RPC providers, monitoring, alerting
