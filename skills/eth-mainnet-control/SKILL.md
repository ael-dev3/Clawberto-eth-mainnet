---
name: eth-mainnet-control
description: TypeScript-first Ethereum mainnet control and planning skill. Use when you need deterministic ETH mainnet RPC/signer readiness checks, fee and block summaries, balance and allowance reads, or native/ERC20 transfer planning.
---

# ETH Mainnet Control

Use this skill first for Ethereum mainnet readiness.
This repo is the standalone ETH mainnet control layer. Protocol-specific planners should live in separate companion repos.

## Core rules

- Mainnet only: `chainId = 1`
- Read / plan first
- Do not broadcast from this skill
- Keep raw private keys out of repo files; use env/Keychain only
- Signer env defaults to `ETH_MAINNET_EXEC_PRIVATE_KEY`

## Commands

Run via:

```bash
npm run eth -- "eth control"
```

Supported commands:
- `eth network`
- `eth fee`
- `eth latest-block`
- `eth control [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]`
- `eth signer [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]`
- `eth token <token>`
- `eth balance <owner> <asset|eth>`
- `eth allowance <token> <owner> <spender|alias>`
- `eth approve-plan <token> <spender|alias> --amount <decimal>`
- `eth transfer-plan <recipient|alias> --amount <decimal>`
- `eth erc20-transfer-plan <token> <recipient|alias> --amount <decimal>`
- `eth alias <alias|address>`
- `eth log-status`
- `eth log-summary`
- `eth log-prompt`

## Aliases

- `weth`
- `usdc`
- `eth` for native-balance reads

## Logging

This skill writes quiet telemetry during command usage and tx-plan preflights, including timestamped fee snapshots in ETH and best-effort USD.

Use:
```bash
npm run --silent eth -- "eth log-status"
npm run --silent eth -- "eth log-summary"
npm run --silent eth -- "eth log-prompt"
```

## References

- `references/control-playbook.md`
- `references/logging-playbook.md`
