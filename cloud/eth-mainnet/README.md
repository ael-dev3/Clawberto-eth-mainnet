# ETH Mainnet Cloud Artifacts

This directory is the cloud-visible surface for device-scoped ETH mainnet telemetry.

Expected generated files:
- `devices/<deviceId>/latest-event.json`
- `devices/<deviceId>/latest-summary.json`
- `devices/<deviceId>/latest-summary.md`
- `skill-update-prompt.md`
- `pending-skill-update.json`

Raw high-volume event logs stay local under `runtime/eth-mainnet/`.
Only rolled-up summaries and update prompts belong here.
