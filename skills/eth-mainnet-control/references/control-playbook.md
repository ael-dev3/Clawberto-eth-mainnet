# ETH Mainnet Control Playbook

## Purpose

Provide one stable place for:
- RPC sanity
- fee and gas guidance
- latest block inspection
- signer readiness
- ETH / ERC20 balance checks
- ERC20 allowance checks
- approval calldata planning
- native ETH transfer planning
- ERC20 transfer planning

## Environment

- RPC env: `ETH_MAINNET_RPC_URL`
- signer env: `ETH_MAINNET_EXEC_PRIVATE_KEY`

## Workflow

1. `eth control`
2. confirm chain id `1`
3. use `eth fee` or `eth latest-block` when current execution conditions matter
4. confirm signer readiness if execution funding matters
5. check balances / allowances
6. generate `approve-plan`, `transfer-plan`, or `erc20-transfer-plan` as needed
7. hand off any protocol-specific work to a separate companion repo

## Notes

- This repo is intentionally plan/read-first.
- Transaction plans stay deterministic and attach preflight metadata when signer env is ready.
