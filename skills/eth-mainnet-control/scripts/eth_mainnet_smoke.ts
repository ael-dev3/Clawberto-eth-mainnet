#!/usr/bin/env node
import {
  buildApprovePlan,
  buildErc20TransferPlan,
  buildEthTransferPlan,
  controlSummary,
  createEthClient,
  MAINNET_ALIASES,
  readBalance,
  readFeeSummary,
  readLatestBlockSummary,
  readTokenMeta,
} from '../../../src/core/eth.js';

function isTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('HTTP request failed') || message.includes('fetch failed');
}

async function main() {
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  const ethTransferPlan = buildEthTransferPlan('0x000000000000000000000000000000000000dEaD', '0.001', MAINNET_ALIASES);
  try {
    const [control, fee, latestBlock, weth, ethBalance, approvePlan, erc20TransferPlan] = await Promise.all([
      controlSummary(client),
      readFeeSummary(client),
      readLatestBlockSummary(client),
      readTokenMeta(client, 'weth', MAINNET_ALIASES),
      readBalance(client, '0x000000000000000000000000000000000000dEaD', 'eth', MAINNET_ALIASES),
      buildApprovePlan(client, 'weth', '0x000000000000000000000000000000000000dEaD', '0.01', MAINNET_ALIASES),
      buildErc20TransferPlan(client, 'weth', '0x000000000000000000000000000000000000dEaD', '0.01', MAINNET_ALIASES),
    ]);
    console.log(JSON.stringify({
      ok: true,
      liveRpc: true,
      control,
      checks: {
        feeBlockNumber: fee.blockNumber,
        latestBlockNumber: latestBlock.number,
        weth: weth.address,
        ethBalance: ethBalance.balance,
        approveTarget: approvePlan.to,
        ethTransferValue: ethTransferPlan.value,
        erc20TransferTarget: erc20TransferPlan.to,
      }
    }, null, 2));
    return;
  } catch (error) {
    if (!isTransportError(error)) throw error;
    console.log(JSON.stringify({
      ok: true,
      liveRpc: false,
      skipped: 'rpc-unavailable',
      reason: error instanceof Error ? error.message : String(error),
      checks: {
        ethTransferValue: ethTransferPlan.value,
        ethTransferTarget: ethTransferPlan.to,
      }
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
