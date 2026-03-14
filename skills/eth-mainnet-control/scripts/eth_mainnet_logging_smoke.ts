#!/usr/bin/env node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEthClient, DEFAULT_RPC_URL } from '../../../src/core/eth.js';
import { createEthMainnetLogger } from '../../../src/logging/logger.js';
import { presentSummary } from '../../../src/logging/presentation.js';
import { capturePreflight } from '../../../src/logging/txTracker.js';

async function main() {
  process.env.ETH_MAINNET_USD_PRICE_OVERRIDE = process.env.ETH_MAINNET_USD_PRICE_OVERRIDE || '3000';
  const repoRoot = mkdtempSync(join(tmpdir(), 'clawberto-eth-logger-'));
  const logger = createEthMainnetLogger({
    repoRoot,
    deviceId: 'smoke-device',
    sessionKey: 'smoke-session',
    skill: 'eth-mainnet-control',
    command: 'logging-smoke',
  });
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL || DEFAULT_RPC_URL);
  await logger.logCommand('logging-smoke', { phase: 'synthetic' }, async () => {
    logger.logStep('ok', { message: 'synthetic-step' });
  });
  await capturePreflight(logger, client, {
    account: '0x000000000000000000000000000000000000dEaD',
    to: '0x000000000000000000000000000000000000dEaD',
    value: 0n,
    label: 'smoke-preflight',
    tags: ['smoke'],
  });
  const summary = logger.summarizeToday();
  const presentedSummary = presentSummary(summary);
  const prompt = readFileSync(logger.paths.cloud.skillUpdatePromptPath, 'utf8');
  const eventLog = readFileSync(logger.paths.eventFile, 'utf8');
  if (summary.avgEstimatedTotalFeeUsd === null) throw new Error('logging smoke expected avgEstimatedTotalFeeUsd');
  if (!eventLog.includes('"estimatedTotalFeeUsd"')) throw new Error('logging smoke expected estimatedTotalFeeUsd in event log');
  if (!eventLog.includes('"ethPriceUsd":3000')) throw new Error('logging smoke expected ETH_MAINNET_USD_PRICE_OVERRIDE to be reflected in event log');
  console.log(JSON.stringify({
    ok: true,
    repoRoot,
    eventFile: logger.paths.eventFile,
    cloudPromptPath: logger.paths.cloud.skillUpdatePromptPath,
    summary: presentedSummary,
    promptPreview: prompt.slice(0, 160),
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
