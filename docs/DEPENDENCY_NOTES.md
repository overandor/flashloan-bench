# Dependency Notes

The bridge runtime does not depend on Python `websockets`.

## Bridge Components

- `bridge/berachain/` uses Node.js, Hardhat, and Ethers
- `bridge/solana/` uses Rust and Anchor
- `bridge/relayer/` uses TypeScript, Ethers, Solana Web3.js, and Zod
- `dashboard/` uses Streamlit and Requests

## Scanned Repository Dependencies

A `websockets` resolver warning may appear from scanned third-party repositories under `github_scan/`. Those scanned repos are research artifacts and are not part of the bridge deployment path.

## Bridge Deployment Validation

For bridge deployment, validate only:

```bash
# Berachain contracts
cd bridge/berachain
npm install
npx hardhat compile

# Solana program
cd ../solana
anchor build

# Relayer
cd ../relayer
npm install
npm run build

# Dashboard
cd ../../dashboard
pip install -r requirements.txt
```

## Important

- Do not use mock transactions
- Do not use simulated TVL
- Do not use fabricated explorer links
- Bridge dependencies are isolated from scanned research repositories
