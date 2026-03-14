# ETH Mainnet Control Playbook

## Purpose

Provide one stable place for:
- RPC sanity
- signer readiness
- ETH / ERC20 balance checks
- ERC20 allowance checks
- approval calldata planning

## Environment

- RPC env: `ETH_MAINNET_RPC_URL`
- signer env: `ETH_MAINNET_EXEC_PRIVATE_KEY`

## Workflow

1. `eth control`
2. confirm chain id `1`
3. confirm signer readiness if execution funding matters
4. check balances / allowances
5. generate approval plan if needed
6. hand protocol-specific planning to downstream skills

## Notes

- This repo is intentionally plan/read-first.
- Protocol adapters should build on top of this layer rather than duplicating control logic.
