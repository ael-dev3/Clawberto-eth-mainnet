# ETH Mainnet Logging Playbook

## Goal

Track ETH mainnet agent usage quietly and deterministically:
- append-only local event journal
- command success/error timings
- gas snapshots before execution/planning
- fee telemetry in ETH plus best-effort USD using a cached ETH/USD quote
- broadcast / receipt / replacement / error telemetry for future execution surfaces
- daily summaries and skill-update prompts
- optional cloud sync via repo-tracked artifacts and opt-in git push

## File model

### Local raw telemetry (gitignored)
- `runtime/eth-mainnet/devices/<deviceId>/events/YYYY-MM-DD.jsonl`
- `runtime/eth-mainnet/devices/<deviceId>/state.json`
- `runtime/eth-mainnet/devices/<deviceId>/latest-summary.json`
- `runtime/eth-mainnet/devices/<deviceId>/latest-summary.md`
- `runtime/eth-mainnet/devices/<deviceId>/logger-errors.jsonl`

### Repo/cloud-visible artifacts
- `cloud/eth-mainnet/devices/<deviceId>/latest-event.json`
- `cloud/eth-mainnet/devices/<deviceId>/latest-summary.json`
- `cloud/eth-mainnet/devices/<deviceId>/latest-summary.md`
- `cloud/eth-mainnet/skill-update-prompt.md`
- `cloud/eth-mainnet/pending-skill-update.json`

These generated cloud artifacts are gitignored by default so local command usage does not leave the repo dirty. If `ETH_MAINNET_AUTO_GIT_SYNC=1` is set, the sync helper force-adds them for the opt-in commit/push flow.

## Environment

- `ETH_MAINNET_DEVICE_ID` — override device id (default: sanitized hostname)
- `OPENCLAW_SESSION_KEY` / `SESSION_KEY` — optional session correlation
- `ETH_MAINNET_AUTO_GIT_SYNC=1` — opt-in auto commit/push of `cloud/eth-mainnet`
- `ETH_MAINNET_GIT_SYNC_INTERVAL_SEC` — debounce auto sync (default `300`)
- `ETH_MAINNET_USD_QUOTE_TTL_MS` — ETH/USD quote cache TTL (default `300000`)
- `ETH_MAINNET_USD_QUOTE_TIMEOUT_MS` — ETH/USD quote fetch timeout (default `4000`)
- `ETH_MAINNET_USD_PRICE_OVERRIDE` — test/sim override for deterministic USD fee logging

## What is logged now

### Automatic on command usage
`eth_mainnet_chat.ts` logs:
- command start
- command finish
- command duration
- quiet error details on failure

### Automatic on tx-plan outputs
When `approve-plan`, `transfer-plan`, or `erc20-transfer-plan` returns `{ to, value, data }` and signer env is ready:
- preflight gas snapshot is captured automatically
- event kind: `tx-preflight`
- includes:
  - base fee gwei
  - max fee gwei
  - max priority fee gwei
  - gas estimate
  - estimated total fee ETH
  - estimated total fee USD
  - ETH/USD quote metadata (`ethPriceUsd`, source, fetchedAt, stale/error state)

### Available for future execution surfaces
`src/logging/txTracker.ts` provides:
- `capturePreflight(...)`
- `logBroadcast(...)`
- `waitForTrackedReceipt(...)`
- `trackTransactionExecution(...)`

Those are the intended hooks for any future executor skill.

## Commands

Generic repo logging inspection:
```bash
npm run --silent eth -- "eth log-status"
npm run --silent eth -- "eth log-summary"
npm run --silent eth -- "eth log-prompt"
```

## General recommendation

- Keep raw event logs local and append-only.
- Let cloud sync carry summaries + prompts, not every raw line to GitHub history.
- Use the prompt file as the durable reminder to update skill/docs when new operational behavior is observed.
- For lowest cost / highest success work, compare daily:
  - estimated vs effective gas price
  - estimated vs actual total fee
  - latency distribution
  - success/failure rate by command family
