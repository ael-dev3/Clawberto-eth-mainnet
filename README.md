# Clawberto ETH Mainnet

TypeScript-first Ethereum mainnet control surface plus protocol adapters, built on `viem`.

This repo is the reusable mainnet layer:
- `src/core` = generic ETH mainnet control/read/planning
- `src/supernova` = Supernova-specific adapter on top of that core
- `skills/*` = deterministic chat/CLI wrappers and smoke scripts

## Design goals

- **Ethereum mainnet only** (`chainId = 1`)
- **Read / plan first**
- **No broadcast from this repo**
- **Deterministic JSON output** for agent use
- **Reusable generic core** so new protocol adapters can share signer, balance, allowance, and approval logic
- **Proxy-aware protocol reads** where needed

## Repo layout

```text
src/
  core/
    eth.ts                  # generic ETH mainnet client, signer, token/balance/allowance helpers
  generated/
    contracts.ts            # canonical Supernova addresses + aliases
  supernova/
    abis.ts                 # minimal verified ABIs used by the adapter
    api.ts                  # Supernova read + planning layer
skills/
  eth-mainnet-control/
    scripts/
      eth_mainnet_chat.ts   # deterministic command surface
      eth_mainnet_smoke.ts  # live smoke validation
    references/
      control-playbook.md
  supernova-dex-mainnet/
    scripts/
      supernova_mainnet_chat.ts
      supernova_mainnet_smoke.ts
    references/
      contracts.md
      interaction-playbook.md
metadata/
  live_contracts_eth_mainnet.json
  live_contracts_eth_mainnet.csv
```

## Install

```bash
npm install
```

## Environment

Optional env vars:
- `ETH_MAINNET_RPC_URL` — defaults to `https://ethereum.publicnode.com`
- `ETH_MAINNET_EXEC_PRIVATE_KEY` — signer key for readiness checks / future simulate-first flows
- `ETH_MAINNET_PK_ENV` — override signer env name for the generic control skill
- `SNOVA_PK_ENV` — override signer env name for the Supernova adapter

If the local signer bootstrap file exists:

```bash
source /Users/marko/.openclaw/eth-mainnet-env.sh
```

## Commands

### Generic ETH mainnet control

```bash
npm run eth -- "eth control"
npm run eth -- "eth signer"
npm run eth -- "eth token weth"
npm run eth -- "eth balance 0x000000000000000000000000000000000000dEaD eth"
npm run eth -- "eth allowance weth 0xOWNER 0xSPENDER"
npm run eth -- "eth approve-plan weth 0xSPENDER --amount 0.01"
```

### Supernova adapter

```bash
npm run snova -- "snova control"
npm run snova -- "snova contracts --all"
npm run snova -- "snova token nova"
npm run snova -- "snova pair-v2 weth nova --stable false"
npm run snova -- "snova pool-cl weth nova"
npm run snova -- "snova gauge 0xa9eae009FCa124EB19092f55120fE6BA2cd2f1B5"
npm run snova -- "snova quote-v2 weth nova --amount-in 0.01"
npm run snova -- "snova swap-plan-eth-in-v2 nova --amount-in-eth 0.01 --recipient 0x000000000000000000000000000000000000dEaD --stable false"
```

## Validation

Main validation entrypoint:

```bash
npm run check
```

This runs:
- `npm run typecheck`
- `npm run smoke:eth`
- `npm run smoke:snova`

Additional live checks used during ship validation:

```bash
source /Users/marko/.openclaw/eth-mainnet-env.sh
npm run eth -- "eth control"
npm run snova -- "snova control"
npm run snova -- "snova contracts --all"
npm run snova -- "snova quote-v2 weth nova --amount-in 0.01"
npm run snova -- "snova gauge 0xa9eae009FCa124EB19092f55120fE6BA2cd2f1B5"
npm run snova -- "snova swap-plan-eth-in-v2 nova --amount-in-eth 0.01 --recipient 0x000000000000000000000000000000000000dEaD --stable false"
```

## Important implementation notes

- `src/core/eth.ts` is the reusable generic layer. New adapters should import from there instead of duplicating RPC/signer/token logic.
- The Supernova adapter wraps the generic helpers with `SUPERNOVA_ALIASES`, so adapter commands like `nova`, `routerv2`, and `weth` resolve deterministically.
- `GaugeManager` is treated as a **proxy read surface**. Read the proxy address using the implementation ABI.
- Supernova `RouterV2.getPoolAmountOut` is read with:

```text
(amountIn, tokenIn, pair)
```

not `(amountIn, tokenIn, tokenOut)`.
- `metadata/live_contracts_eth_mainnet.json` is resolved from repo root so `snova contracts --all` works regardless of caller cwd.

## Reusing the core for new adapters

The intended pattern is:
1. put chain-generic ETH mainnet helpers in `src/core/eth.ts`
2. define protocol addresses in `src/generated/*`
3. keep protocol ABIs in `src/<protocol>/abis.ts`
4. expose protocol reads/plans in `src/<protocol>/api.ts`
5. wrap them in deterministic `skills/<protocol>/scripts/*`
6. add live smoke coverage before adding any write path

## Current scope

This repo is **read / inspect / plan** only. It does not broadcast transactions.

That keeps it safe for operator use while still producing deterministic calldata plans that can be reviewed or simulated by downstream execution surfaces.
