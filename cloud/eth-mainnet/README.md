# ETH Mainnet Cloud Artifacts

This directory is the cloud-visible surface for device-scoped ETH mainnet telemetry.

Expected generated files:
- `devices/<deviceId>/latest-event.json`
- `devices/<deviceId>/latest-summary.json`
- `devices/<deviceId>/latest-summary.md`
- `skill-update-prompt.md`
- `pending-skill-update.json`

Raw high-volume event logs stay local under `runtime/eth-mainnet/`.
These generated files are gitignored by default so routine local usage stays clean. When `ETH_MAINNET_AUTO_GIT_SYNC=1` is enabled, the sync helper force-adds and pushes them intentionally.
