# Berachain-Solana Native Bridge

A production-grade native bridge between Berachain and Solana using a custodied lock/mint and burn/release model with validator quorum signatures.

## Architecture

### Components

1. **Berachain Contract** (`bridge/berachain/src/NativeBridgeLocker.sol`)
   - Locks native ERC-20 tokens for minting wrapped tokens on Solana
   - Releases native tokens upon receiving validator-signed release requests from Solana burns
   - Uses OpenZeppelin SafeERC20 and Ownable for security
   - Supports threshold validator signatures (multi-sig)
   - Maps Solana mint addresses to Berachain token addresses

2. **Solana Program** (`bridge/solana/programs/native_bridge/src/lib.rs`)
   - Mints wrapped tokens when receiving lock attestations from Berachain
   - Burns wrapped tokens and emits stable release IDs for Berachain release
   - Supports threshold validator set (multi-sig)
   - Uses Anchor framework

3. **Relayer Service** (`bridge/relayer/src/index.ts`)
   - Watches `DepositLocked` events on Berachain and triggers Solana minting
   - Watches `WrappedBurned` events on Solana and submits release transactions to Berachain
   - Collects validator signatures for threshold quorum
   - Built with ethers.js and @solana/web3.js

4. **Client SDKs**
   - Go client (`bridge/go/`)
   - C++ client (`bridge/cpp/`)
   - Shared transfer schema (`bridge/shared/transfer-schema.ts`)

## Transfer Flows

### Berachain → Solana (Lock/Mint)

1. User calls `lock(token, amount, solanaRecipient, destinationChainId)` on Berachain
2. Contract locks tokens and emits `DepositLocked` event
3. Relayer observes event and submits `mint_wrapped` instruction on Solana with validator signature
4. Solana program mints wrapped tokens to recipient

### Solana → Berachain (Burn/Release)

1. User calls `burn_wrapped(releaseId, destinationRecipient, amount, destinationChain)` on Solana
2. Program burns wrapped tokens and emits `WrappedBurned` event with stable `releaseId`
3. Relayer observes event and builds `ReleaseRequest`
4. Validators sign the release digest
5. Relayer submits `release(request, signatures)` on Berachain once threshold is met
6. Berachain contract releases native tokens to recipient

## Deployment

### Prerequisites

- Node.js 18+
- Rust and Cargo (for Solana)
- Foundry or Hardhat (for Berachain)
- Anchor CLI (for Solana)

### Berachain Deployment

```bash
cd bridge/berachain
npm install
export BERACHAIN_RPC_URL=https://your-berachain-rpc
export PRIVATE_KEY=your-deployer-private-key
export VALIDATORS=0xvalidator1,0xvalidator2,0xvalidator3
export VALIDATOR_THRESHOLD=2
npm run deploy
```

### Solana Deployment

```bash
cd bridge/solana
anchor build
export VALIDATORS=validatorPubkey1,validatorPubkey2,validatorPubkey3
export VALIDATOR_THRESHOLD=2
anchor deploy
```

### Relayer Configuration

Create `.env` in `bridge/relayer/`:

```env
BERACHAIN_RPC_URL=https://your-berachain-rpc
BERACHAIN_BRIDGE_ADDRESS=0xdeployed-contract-address
RELAYER_PRIVATE_KEY=your-relayer-private-key
SOLANA_RPC_URL=https://your-solana-rpc
SOLANA_BRIDGE_PROGRAM_ID=Br1dgE1111111111111111111111111111111111111
VALIDATOR_ADDRESSES=0xvalidator1,0xvalidator2,0xvalidator3
VALIDATOR_THRESHOLD=2
```

Run relayer:

```bash
cd bridge/relayer
npm install
npm run dev
```

## Security Considerations

- **Validator Quorum**: Both chains require threshold signatures for mint/release operations
- **Replay Protection**: Separate `lockedTransfers` and `releasedTransfers` mappings prevent replay attacks
- **Token Mapping**: Berachain contract only releases tokens for mapped Solana mints
- **SafeERC20**: All token transfers use OpenZeppelin's SafeERC20
- **Owner Controls**: Only contract owner can update validators, threshold, and token mappings

## Development

### Build

```bash
# Berachain
cd bridge/berachain
npm run compile

# Solana
cd bridge/solana
anchor build

# Relayer
cd bridge/relayer
npm run build
```

### Test

```bash
# Berachain
cd bridge/berachain
npm run test

# Solana
cd bridge/solana
anchor test
```

## License

MIT
