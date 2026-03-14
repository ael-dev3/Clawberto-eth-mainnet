# Supernova ETH Mainnet Interaction Playbook

## Intent

Use this adapter for deterministic on-chain reads and calldata planning on Ethereum mainnet.

## Operating posture

- Mainnet only
- Read / inspect first
- Build calldata plans before any external execution step
- Do not broadcast from this repo
- Prefer explicit flags over ambiguous natural language

## Recommended flow

1. `snova control`
2. `snova contracts --all` if you need the current inventory / proxy context
3. `snova token <token>` to normalize aliases and decimals
4. `snova pair-v2` / `snova pool-cl` to discover liquidity surface
5. `snova gauge <pool>` for emissions / gauge state
6. `snova quote-v2` for RouterV2 output discovery
7. `snova allowance` / `snova approve-plan` for ERC20 prep
8. `snova swap-plan-*` to build calldata, value, and slippage-bounded output minimums

## Validated patterns

### Quote WETH -> NOVA

```bash
npm run snova -- "snova quote-v2 weth nova --amount-in 0.01"
```

### Build ETH -> NOVA swap plan

```bash
npm run snova -- "snova swap-plan-eth-in-v2 nova --amount-in-eth 0.01 --recipient 0x000000000000000000000000000000000000dEaD --stable false"
```

### Read gauge state for the live volatile WETH/NOVA pair

```bash
npm run snova -- "snova gauge 0xa9eae009FCa124EB19092f55120fE6BA2cd2f1B5"
```

## Sharp edges already handled

### 1) RouterV2 quote signature

Use:

```text
getPoolAmountOut(amountIn, tokenIn, pair)
```

not `(amountIn, tokenIn, tokenOut)`.

### 2) GaugeManager proxy handling

Use the proxy address with the implementation ABI.

### 3) Adapter aliasing

The Supernova adapter wraps the generic core with `SUPERNOVA_ALIASES`, so adapter-native names like `nova`, `routerv2`, and `gaugemanager` resolve correctly.

### 4) Deterministic route selection

If both stable and volatile V2 pairs exist, pass `--stable true|false` explicitly.

## Output expectations

Every command returns JSON suitable for:
- agent consumption
- operator inspection
- downstream simulation / execution tooling

## Non-goals

- broadcasting transactions
- hidden retries that mask bad assumptions
- fuzzy command parsing
