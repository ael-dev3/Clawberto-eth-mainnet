#!/usr/bin/env node
import { createEthClient } from '../../../src/core/eth.js';
import { buildApprovePlan, buildSwapPlanEthInV2, loadLiveContracts, quoteV2, readPairV2, readTokenMeta, supernovaRegistry } from '../../../src/supernova/api.js';

async function main() {
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  const [nova, pair, quote, approvePlan, ethInPlan, liveContracts] = await Promise.all([
    readTokenMeta(client, 'nova'),
    readPairV2(client, 'weth', 'nova', false),
    quoteV2(client, 'weth', 'nova', '0.01'),
    buildApprovePlan(client, 'nova', 'routerv2', '1'),
    buildSwapPlanEthInV2(client, 'nova', '0.01', '0x000000000000000000000000000000000000dEaD', false, 50, 1200),
    Promise.resolve(loadLiveContracts()),
  ]);
  console.log(JSON.stringify({
    ok: true,
    core: supernovaRegistry(),
    checks: {
      novaSymbol: nova.symbol,
      volatilePair: pair.pair,
      quoteAvailable: quote.quoteAvailable,
      approveTarget: approvePlan.to,
      ethInPlanTarget: ethInPlan.to,
      ethInPlanPair: ethInPlan.pair,
      liveContractCount: liveContracts.length,
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
