# Clawberto ETH Mainnet

TypeScript-first Ethereum mainnet control layer built on `viem`.

Tracked source is all TypeScript. The `.js` import suffixes inside `.ts` files are intentional `NodeNext`/ESM output specifiers.

## Scope

- Ethereum mainnet only (`chainId = 1`)
- Read, inspect, and transaction-plan only
- Deterministic JSON output for every command
- Automatic preflight attachment for tx-plan commands when signer env is ready
- No transaction broadcast from this repo

Protocol-specific planners belong in separate companion repos.

## Repo layout

```text
src/
  core/
    eth.ts
  logging/
    types.ts
    logger.ts
    metrics.ts
    presentation.ts
    priceFeed.ts
    githubSync.ts
    txTracker.ts
skills/
  eth-mainnet-control/
    scripts/
      eth_mainnet_chat.ts
      eth_mainnet_smoke.ts
      eth_mainnet_logging_smoke.ts
    references/
      control-playbook.md
      logging-playbook.md
cloud/
  eth-mainnet/
```

## Install

```bash
npm install
```

## Environment

- `ETH_MAINNET_RPC_URL` defaults to `https://ethereum.publicnode.com`
- `ETH_MAINNET_EXEC_PRIVATE_KEY` is the default signer env for readiness checks and tx-plan preflights
- `ETH_MAINNET_PK_ENV` overrides the signer env name
- `ETH_MAINNET_DEVICE_ID` overrides the telemetry device id
- `ETH_MAINNET_AUTO_GIT_SYNC=1` opt-in sync for generated `cloud/eth-mainnet` artifacts
- `ETH_MAINNET_GIT_SYNC_INTERVAL_SEC` sets git sync debounce seconds
- `ETH_MAINNET_USD_QUOTE_TTL_MS` sets the ETH/USD quote cache TTL
- `ETH_MAINNET_USD_QUOTE_TIMEOUT_MS` sets the ETH/USD quote fetch timeout
- `ETH_MAINNET_USD_PRICE_OVERRIDE` forces deterministic ETH/USD pricing for tests and simulations

If the local bootstrap file exists:

```bash
source /Users/marko/.openclaw/eth-mainnet-env.sh
```

## Commands

Run through the deterministic CLI wrapper:

```bash
npm run --silent eth -- "eth help"
```

Available commands:
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

Example usage:

```bash
npm run --silent eth -- "eth control"
npm run --silent eth -- "eth fee"
npm run --silent eth -- "eth latest-block"
npm run --silent eth -- "eth balance 0x000000000000000000000000000000000000dEaD eth"
npm run --silent eth -- "eth approve-plan weth 0x000000000000000000000000000000000000dEaD --amount 0.01"
npm run --silent eth -- "eth transfer-plan 0x000000000000000000000000000000000000dEaD --amount 0.001"
npm run --silent eth -- "eth erc20-transfer-plan weth 0x000000000000000000000000000000000000dEaD --amount 0.01"
```

## Validation

Primary validation:

```bash
npm run check
```

This runs:
- `npm run typecheck`
- `npm run smoke:eth`
- `npm run smoke:logging`

## Logging

The repo includes quiet local telemetry for command usage and tx-plan preflights.

What is logged:
- command start, finish, duration, and quiet errors
- append-only local JSONL event journals
- preflight gas snapshots for tx-plan commands when signer env is available
- estimated fee telemetry in ETH and best-effort USD
- daily summaries and skill-update prompt artifacts

Paths:
- local raw logs: `runtime/eth-mainnet/devices/<deviceId>/...`
- cloud-visible summaries and prompts: `cloud/eth-mainnet/...`

Inspection commands:

```bash
npm run --silent eth -- "eth log-status"
npm run --silent eth -- "eth log-summary"
npm run --silent eth -- "eth log-prompt"
```

## Current boundary

This repo is intentionally limited to ETH mainnet control and planning. It can inspect state and build transaction calldata, but it does not send transactions.
