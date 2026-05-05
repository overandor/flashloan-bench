# Testnet Setup Guide

This guide explains how to configure the bridge for testnet deployment.

## Prerequisites

- Node.js 18+ for Berachain contracts and relayer
- Rust and Anchor for Solana program
- Solana CLI installed
- Berachain testnet RPC endpoint
- Solana devnet RPC endpoint
- Validator private keys (at least 3)
- Testnet tokens for funding

## Configuration Files

### 1. Berachain Contract

**File:** `bridge/berachain/.env`

```bash
cd bridge/berachain
cp .env.example .env
# Edit .env with your actual values
```

Required variables:
- `BERACHAIN_TESTNET_RPC_URL` - Berachain testnet RPC endpoint
- `PRIVATE_KEY` - Deployer private key
- `VALIDATORS` - Comma-separated validator addresses
- `VALIDATOR_THRESHOLD` - Number of signatures required (e.g., 2)

### 2. Solana Program

**File:** `bridge/solana/Anchor.toml`

The Anchor.toml is already configured for devnet:
```toml
[provider]
cluster = "Devnet"
wallet = "~/.config/solana/id.json"
```

Required setup:
```bash
# Configure Solana CLI for devnet
solana config set --url devnet

# Ensure your wallet has devnet SOL
solana airdrop 2
```

### 3. Relayer

**File:** `bridge/relayer/.env`

```bash
cd bridge/relayer
cp .env.example .env
# Edit .env with your actual values
```

Required variables:
- `BERACHAIN_RPC_URL` - Berachain RPC endpoint
- `BERACHAIN_BRIDGE_ADDRESS` - Deployed contract address (after deployment)
- `RELAYER_PRIVATE_KEY` - Relayer private key
- `SOLANA_RPC_URL` - Solana devnet RPC endpoint
- `SOLANA_BRIDGE_PROGRAM_ID` - Deployed program ID (after deployment)
- `VALIDATOR_ADDRESSES` - Comma-separated validator addresses (must match bridge)
- `VALIDATOR_THRESHOLD` - Number of signatures required (must match bridge)
- `DRY_RUN` - Set to "true" for testing, "false" for production

## Deployment Steps

### Step 1: Compile Berachain Contracts

```bash
cd bridge/berachain
npm install
npx hardhat compile
```

### Step 2: Deploy Berachain Contract

```bash
npx hardhat run scripts/deploy.ts --network berachainTestnet
```

Save the deployed contract address for the relayer configuration.

### Step 3: Build Solana Program

```bash
cd ../solana
anchor build
```

### Step 4: Deploy Solana Program

```bash
anchor deploy --provider.cluster devnet
```

Save the deployed program ID for the relayer configuration.

### Step 5: Update Relayer Configuration

Update `bridge/relayer/.env` with:
- `BERACHAIN_BRIDGE_ADDRESS` - From step 2
- `SOLANA_BRIDGE_PROGRAM_ID` - From step 4

### Step 6: Build Relayer

```bash
cd ../relayer
npm install
npm run build
```

### Step 7: Run Relayer in Dry-Run Mode

```bash
DRY_RUN=true npm start
```

This will print release requests without submitting them to the blockchain.

### Step 8: Fund Bridge with Native BERA (if needed)

For native SOL → native BERA transfers:

```bash
cd ../berachain
npx hardhat run scripts/fund-native.ts --network berachainTestnet
```

## Verification

After deployment, verify:

1. Berachain contract is deployed at the expected address
2. Solana program is deployed at the expected program ID
3. Validators are correctly set on the contract
4. Token mappings are configured (if using ERC-20/SPL)
5. Relayer can connect to both RPC endpoints
6. Relayer dry-run logs show correct event parsing

## Next Steps

- Execute test transactions
- Capture explorer links
- Update Issue #4 with transaction proof
- Add dashboard screenshot
- Update docs/TESTNET_DEMO.md with real values

## Security Notes

- **NEVER commit .env files** - They contain private keys
- **Use testnet only** - Do not use mainnet keys for testnet
- **Revoke exposed tokens** - If any tokens were exposed, revoke them immediately
- **Start with DRY_RUN=true** - Verify relayer behavior before enabling real submissions
