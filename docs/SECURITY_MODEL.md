# Security Model

## Bridge Architecture

The Berachain-Solana Native Bridge is a **custodial validator-quorum bridge**, not a trustless bridge. This is an intentional design choice for rapid deployment and cross-chain interoperability.

## Trust Assumptions

### Validator Set
- The bridge relies on a set of trusted validators to sign release requests
- Validators must:
  - Keep their private keys secure
  - Monitor both chains for burn/lock events
  - Sign release requests honestly and promptly
  - Coordinate to meet the signature threshold

### Relayer
- The relayer service watches events and submits transactions
- The relayer must:
  - Maintain secure connections to both RPC endpoints
  - Correctly parse and validate events
  - Protect validator private keys
  - Operate with high availability

### Bridge Contracts
- The Berachain contract and Solana program must be bug-free
- Upgrades require owner approval (centralized upgrade path)
- Token mappings are set by the contract owner

## Security Properties

### Threshold Signatures
- Release requests require signatures from `validatorThreshold` validators
- Threshold can be updated by contract owner
- Active validator count is tracked to prevent threshold > validators

### Replay Protection
- Berachain: `lockedTransfers` and `releasedTransfers` mappings prevent replay
- Solana: Unique `transfer_id` and `release_id` for each operation
- Nonces are tracked per user on Berachain

### Token Safety
- Berachain: Uses OpenZeppelin SafeERC20 for all token transfers
- Native BERA release uses `call{}` pattern to avoid gas stipend issues
- Token mappings must be explicitly set by owner

## Known Limitations

### Centralization
- Contract owner can:
  - Add/remove validators
  - Change validator threshold
  - Update token mappings
  - Upgrade contracts (if upgradeable pattern used)

### Custodial Risk
- Locked tokens are held by the bridge contract
- If validators collude or are compromised, funds can be stolen
- If relayer is compromised, it could submit malicious release requests

### Liveness
- Bridge requires validators to be online and signing
- If validators go offline, releases cannot be completed
- Relayer downtime prevents new transfers

## Security Best Practices

### For Deployers
1. Use a diverse validator set (geographically and organizationally distributed)
2. Set threshold to at least 2/3 of validators
3. Use hardware security modules (HSMs) for validator keys
4. Implement monitoring for unusual activity
5. Have a pause/emergency mechanism
6. Consider time-locked upgrades

### For Users
1. Only bridge amounts you can afford to lose
2. Verify validator set and threshold before using
3. Monitor bridge contract for changes
4. Start with small test transfers
5. Understand this is not trustless

## Audit Status

**Status:** Not audited

The bridge is currently in prototype phase. A professional security audit is required before production use.

## Future Security Improvements

- [ ] Implement optimistic verification with fraud proofs
- [ ] Add ZK proof verification for cross-chain state
- [ ] Implement decentralized validator selection
- [ ] Add circuit breaker / emergency pause
- [ ] Time-locked governance for critical changes
- [ ] Insurance fund for covered losses
