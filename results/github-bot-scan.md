# GitHub Flash-Loan Bot SAFE Fork-Only Evaluation

Generated: 2026-05-04 20:53:49

## Safety Constraints Enforced
- Fork-only testing on local node (`anvil` / `hardhat` local network)
- No live trade script execution
- No withdrawal keys used
- No mainnet transaction broadcasting

## Discovery Criteria
- Updated in last 24 months
- Stars >= 100
- Selected repos: 4 (max target: 15)

## Summary Table

| Repo | Stars | Pushed At | Framework | Clone | Build | Test | Red Flags |
|---|---:|---|---|---|---|---|---:|
| [ccyanxyz/uniswap-arbitrage-analysis](https://github.com/ccyanxyz/uniswap-arbitrage-analysis) | 2116 | 2025-12-11 | unknown | Success | Skipped | Skipped | 0 |
| [pedrobergamini/flashloaner-contract](https://github.com/pedrobergamini/flashloaner-contract) | 544 | 2025-12-04 | foundry | Success | Failed | Skipped | 3 |
| [Devilla/eth-arbitrage](https://github.com/Devilla/eth-arbitrage) | 410 | 2026-03-16 | hardhat | Success | Success | Success | 0 |
| [hanshaze/solana-sniper-copy-mev-trading-bot](https://github.com/hanshaze/solana-sniper-copy-mev-trading-bot) | 150 | 2026-05-03 | unknown | Success | Skipped | Skipped | 0 |

## Per-Repo Findings

### ccyanxyz/uniswap-arbitrage-analysis
- URL: https://github.com/ccyanxyz/uniswap-arbitrage-analysis
- Stars: 2116
- Pushed At: 2025-12-11T18:40:49Z
- Framework: unknown
- Build Status: Skipped
- Build Note: Unsupported framework (not Foundry/Hardhat)
- Test Status: Skipped
- Test Type: N/A
- Red Flags: none detected

### pedrobergamini/flashloaner-contract
- URL: https://github.com/pedrobergamini/flashloaner-contract
- Stars: 544
- Pushed At: 2025-12-04T16:28:53Z
- Framework: foundry
- Build Status: Failed
- Build Note: Command not found: forge ([Errno 2] No such file or directory: 'forge')
- Test Status: Skipped
- Test Type: N/A
- Red Flags (3):
  - Broadcast-related code path in README.md
  - Broadcast-related code path in script/DeployFlashLoaner.s.sol
  - Broadcast-related code path in script/SimulateFlashSwap.s.sol

### Devilla/eth-arbitrage
- URL: https://github.com/Devilla/eth-arbitrage
- Stars: 410
- Pushed At: 2026-03-16T18:28:02Z
- Framework: hardhat
- Build Status: Success
- Build Note: npm install + hardhat compile passed
- Test Status: Success
- Test Type: Hardhat test (local hardhat network)
- Runtime Errors / Tail Output:
```text




  Lock
    Deployment
      ✔ Should set the right unlockTime (777ms)
      ✔ Should set the right owner
      ✔ Should receive and store the funds to lock
      ✔ Should fail if the unlockTime is not in the future
    Withdrawals
      Validations
        ✔ Should revert with the right error if called too soon
        ✔ Should revert with the right error if called from another account
        ✔ Shouldn't fail if the unlockTime has arrived and the owner calls it
      Events
        ✔ Should emit an event on withdrawals
      Transfers
        ✔ Should transfer the funds to the owner


  9 passing (971ms)


WARNING: You are using a version of Node.js that is not supported, and it may work incorrectly, or not work at all. See https://hardhat.org/nodejs-versions

```
- Red Flags: none detected

### hanshaze/solana-sniper-copy-mev-trading-bot
- URL: https://github.com/hanshaze/solana-sniper-copy-mev-trading-bot
- Stars: 150
- Pushed At: 2026-05-03T18:38:24Z
- Framework: unknown
- Build Status: Skipped
- Build Note: Unsupported framework (not Foundry/Hardhat)
- Test Status: Skipped
- Test Type: N/A
- Red Flags: none detected

## Top 3 Actually Runnable Repos
1. [Devilla/eth-arbitrage](https://github.com/Devilla/eth-arbitrage) - framework: hardhat, stars: 410, flags: 0
