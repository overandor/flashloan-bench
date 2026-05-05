# Testnet Deployment Guide

## Overview

This guide describes how to deploy the Berachain-Solana bridge to testnet and validate the end-to-end transfer flow.

**Status:** Not yet deployed. This is a planning document for future testnet deployment.

## Prerequisites

- Berachain testnet RPC endpoint
- Solana devnet/testnet RPC endpoint
- Validator private keys (at least 3 for threshold=2)
- Relayer private key
- Testnet tokens for funding

## Deployment Steps

### 1. Deploy Berachain Contract

```bash
cd bridge/berachain

# Set environment variables
export BERACHAIN_RPC_URL=https://berachain-testnet-rpc.example.com
export PRIVATE_KEY=your_berachain_private_key
export INITIAL_VALIDATORS="0xvalidator1,0xvalidator2,0xvalidator3"
export VALIDATOR_THRESHOLD=2

# Deploy
npm run deploy
```

Save the deployed contract address for the relayer configuration.

### 2. Deploy Solana Program

```bash
cd bridge/solana

# Set environment variables
export SOLANA_RPC_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json
export VALIDATORS=validator1_pubkey,validator2_pubkey,validator3_pubkey
export VALIDATOR_THRESHOLD=2

# Deploy
anchor deploy
```

Save the deployed program ID for the relayer configuration.

### 3. Configure Token Mapping

On Berachain, map Solana mint addresses to Berachain token addresses:

```bash
# Example: Map USDC on Solana to USDC on Berachain
cast send <bridge_contract_address> "setTokenMapping(bytes32,address)" \
  <solana_usdc_mint_bytes32> <berachain_usdc_address>
```

### 4. Fund Bridge with Native BERA

For native SOL → native BERA transfers, fund the Berachain contract:

```bash
cast send <bridge_contract_address> --value 10ether
```

### 5. Configure Relayer

```bash
cd bridge/relayer

# Create .env file
cat > .env << EOF
BERACHAIN_RPC_URL=https://berachain-testnet-rpc.example.com
BERACHAIN_BRIDGE_ADDRESS=<deployed_contract_address>
RELAYER_PRIVATE_KEY=relayer_private_key
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_BRIDGE_PROGRAM_ID=<deployed_program_id>
VALIDATOR_ADDRESSES=validator1,validator2,validator3
VALIDATOR_THRESHOLD=2
DRY_RUN=true  # Start with dry-run mode
EOF

# Build
npm run build

# Run relayer
npm start
```

## Testnet Demo Flow

### Berachain → Solana (ERC-20 → SPL)

1. User approves bridge contract to spend their ERC-20 tokens on Berachain
2. User calls `lock(token, amount, solanaRecipient, destinationChainId)`
3. Relayer observes `DepositLocked` event
4. Relayer submits `mint_wrapped` instruction on Solana with validator signature
5. Solana program mints wrapped tokens to recipient

**Transaction links to add after deployment:**
- Berachain lock transaction: [TODO]
- Solana mint transaction: [TODO]

### Solana → Berachain (SPL → ERC-20)

1. User calls `burn_wrapped(releaseId, destinationRecipient, amount, destinationChain)` on Solana
2. Solana program burns wrapped tokens and emits `WrappedBurned` event
3. Relayer observes event and builds release request
4. Validators sign the release digest
5. Relayer submits `release(request, signatures)` on Berachain
6. Berachain contract releases ERC-20 tokens to recipient

**Transaction links to add after deployment:**
- Solana burn transaction: [TODO]
- Berachain release transaction: [TODO]

### Solana → Berachain (Native SOL → Native BERA)

1. User calls `burn_native(releaseId, destinationRecipient, amount, destinationChain)` on Solana
2. Solana program transfers native SOL to bridge state and emits `WrappedBurned` event
3. Relayer observes event and builds release request with `isNative: true`
4. Validators sign the release digest
5. Relayer submits `release(request, signatures)` on Berachain
6. Berachain contract releases native BERA to recipient

**Transaction links to add after deployment:**
- Solana native burn transaction: [TODO]
- Berachain native release transaction: [TODO]

## Monitoring

### Event Monitoring

Monitor the following events:

**Berachain:**
- `DepositLocked` - New lock requests
- `FundsReleased` - Completed releases
- `ValidatorUpdated` - Validator set changes
- `ValidatorThresholdUpdated` - Threshold changes

**Solana:**
- `WrappedBurned` - Burn requests
- `WrappedMinted` - Mint completions (if added)

### Health Checks

- Bridge contract balance (native BERA)
- Validator signature submission rate
- Relayer uptime
- RPC endpoint health

## Security Considerations for Testnet

1. **Never use production keys** on testnet
2. **Use small amounts** for testing
3. **Monitor for unusual activity** even on testnet
4. **Test emergency pause** mechanisms
5. **Verify threshold signature logic** with real validators

## Next Steps

- [ ] Deploy to Berachain testnet
- [ ] Deploy to Solana devnet
- [ ] Configure token mappings
- [ ] Run relayer in dry-run mode
- [ ] Execute test transfers
- [ ] Add transaction links to this document
- [ ] Document any issues found
- [ ] Prepare for mainnet deployment

## Resources

- Berachain testnet docs: https://docs.berachain.com
- Solana devnet docs: https://docs.solana.com/developing/clients/jsonrpc-api#devnet
- Anchor deployment guide: https://www.anchor-lang.com/docs/deployment
