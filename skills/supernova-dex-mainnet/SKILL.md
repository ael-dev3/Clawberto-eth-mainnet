---
name: supernova-dex-mainnet
description: TypeScript-first Ethereum mainnet interaction skill for Supernova DEX. Use when you need deterministic Supernova V2/CL reads, gauge inspection, NFPM position inspection, RouterV2 swap planning, or ETH mainnet Supernova control status on chainId 1.
---

# Supernova DEX Mainnet

Use this skill after `eth-mainnet-control` or via its built-in `snova control` check.
It is a protocol adapter layered on top of the reusable generic ETH mainnet core in `src/core/eth.ts`.

## Core rules

- Mainnet only: `chainId = 1`
- Read / plan first. Do not broadcast from this skill.
- Use RouterV2 as the primary write-planning surface first.
- Treat GaugeManager as a proxy read surface using the implementation ABI.
- Keep deterministic command syntax; avoid ambiguous natural language.

## Commands

Run via:

```bash
npm run snova -- "snova control"
```

Supported commands:
- `snova control [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]`
- `snova contracts [--all]`
- `snova token <token>`
- `snova balance <owner> <asset|eth>`
- `snova allowance <token> <owner> <spender|alias>`
- `snova pair-v2 <tokenA> <tokenB> [--stable]`
- `snova pool-cl <tokenA> <tokenB>`
- `snova gauge <pool>`
- `snova position <tokenId>`
- `snova quote-v2 <tokenIn> <tokenOut> --amount-in <decimal>`
- `snova approve-plan <token> <spender|alias> --amount <decimal>`
- `snova swap-plan-v2 <tokenIn> <tokenOut> --amount-in <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]`
- `snova swap-plan-eth-in-v2 <tokenOut> --amount-in-eth <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]`
- `snova swap-plan-eth-out-v2 <tokenIn> --amount-in <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]`

## References

- `references/contracts.md`
- `references/interaction-playbook.md`
