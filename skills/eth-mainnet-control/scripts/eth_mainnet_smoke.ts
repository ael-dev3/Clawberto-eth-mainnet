#!/usr/bin/env node
import { buildApprovePlan, controlSummary, createEthClient, MAINNET_ALIASES, readBalance, readTokenMeta } from '../../../src/core/eth.js';

async function main() {
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  const [control, weth, ethBalance, approvePlan] = await Promise.all([
    controlSummary(client),
    readTokenMeta(client, 'weth', MAINNET_ALIASES),
    readBalance(client, '0x000000000000000000000000000000000000dEaD', 'eth', MAINNET_ALIASES),
    buildApprovePlan(client, 'weth', '0x000000000000000000000000000000000000dEaD', '0.01', MAINNET_ALIASES),
  ]);
  console.log(JSON.stringify({
    ok: true,
    control,
    checks: {
      weth: weth.address,
      ethBalance: ethBalance.balance,
      approveTarget: approvePlan.to,
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
