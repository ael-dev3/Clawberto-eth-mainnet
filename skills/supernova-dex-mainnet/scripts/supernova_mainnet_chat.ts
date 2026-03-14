#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { controlSummary, createEthClient, DEFAULT_SIGNER_ENV, readSigner } from '../../../src/core/eth.js';
import { createEthMainnetLogger } from '../../../src/logging/logger.js';
import { capturePreflight } from '../../../src/logging/txTracker.js';
import type { TxPlanLike } from '../../../src/logging/types.js';
import { SUPERNOVA_CONTRACTS } from '../../../src/generated/contracts.js';
import { buildApprovePlan, buildSwapPlanEthInV2, buildSwapPlanEthOutV2, buildSwapPlanV2, loadLiveContracts, quoteV2, readAllowance, readBalance, readClPool, readGauge, readPairV2, readPosition, readTokenMeta, supernovaRegistry } from '../../../src/supernova/api.js';

type ParsedArgs = { positionals: string[]; flags: Map<string, string | true> };

function tokenize(argv: string[]) {
  const raw = argv.length === 1 ? argv[0].trim() : argv.join(' ').trim();
  return raw.split(/\s+/).filter(Boolean);
}

function parseArgs(argv: string[]): ParsedArgs {
  const tokens = tokenize(argv);
  if (tokens[0] === 'snova' || tokens[0] === '/snova' || tokens[0] === 'supernova') tokens.shift();
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = tokens[i + 1];
    if (!next || next.startsWith('--')) flags.set(key, true);
    else { flags.set(key, next); i += 1; }
  }
  return { positionals, flags };
}

function getFlag(parsed: ParsedArgs, name: string, fallback?: string) {
  const v = parsed.flags.get(name);
  if (typeof v === 'string') return v;
  if (v === true) return 'true';
  return fallback;
}

function getBoolFlag(parsed: ParsedArgs, name: string): boolean | null {
  const v = parsed.flags.get(name);
  if (v === undefined) return null;
  if (v === true) return true;
  const text = String(v).toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(text)) return true;
  if (['0', 'false', 'no', 'n'].includes(text)) return false;
  throw new Error(`Invalid boolean for --${name}: ${v}`);
}

function requirePositional(parsed: ParsedArgs, idx: number, label: string) {
  const value = parsed.positionals[idx];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function print(payload: unknown): never {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

function isTxPlanLike(value: unknown): value is TxPlanLike {
  return !!value && typeof value === 'object' && 'to' in value && 'data' in value;
}

function objectFromFlags(flags: Map<string, string | true>) {
  return Object.fromEntries(flags.entries());
}

function readPrompt(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

async function maybeAttachPreflight(client: ReturnType<typeof createEthClient>, logger: ReturnType<typeof createEthMainnetLogger>, payload: unknown, pkEnv: string) {
  if (!isTxPlanLike(payload)) return payload;
  const signer = await readSigner(client, pkEnv);
  if (!signer.ready || !signer.address) {
    return {
      ...payload,
      preflight: {
        available: false,
        reason: signer.reason,
      },
    };
  }
  const preflight = await capturePreflight(logger, client, {
    account: signer.address,
    to: payload.to,
    value: payload.value ? BigInt(payload.value) : 0n,
    data: payload.data,
    label: payload.action || 'plan',
    tags: ['plan', 'supernova'],
  });
  return {
    ...payload,
    preflight: {
      available: true,
      txKey: preflight.txKey,
      gasEstimate: preflight.gasEstimate?.toString() ?? null,
      gasEstimateError: preflight.gasEstimateError,
      feeEstimateError: preflight.feeEstimateError,
      baseFeeError: preflight.baseFeeError,
      feeHistoryError: preflight.feeHistoryError,
      baseFeePerGasGwei: preflight.baseFeePerGas ? (Number(preflight.baseFeePerGas) / 1e9).toString() : null,
      maxFeePerGasGwei: preflight.maxFeePerGas ? (Number(preflight.maxFeePerGas) / 1e9).toString() : null,
      maxPriorityFeePerGasGwei: preflight.maxPriorityFeePerGas ? (Number(preflight.maxPriorityFeePerGas) / 1e9).toString() : null,
      estimatedTotalFeeWei: preflight.estimatedTotalFeeWei?.toString() ?? null,
      estimatedTotalFeeEth: preflight.estimatedTotalFeeWei ? (Number(preflight.estimatedTotalFeeWei) / 1e18).toString() : null,
    },
  };
}

async function runCommand(parsed: ParsedArgs, logger: ReturnType<typeof createEthMainnetLogger>) {
  const cmd = parsed.positionals[0];
  if (!cmd) throw new Error('Missing command');
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  const pkEnv = getFlag(parsed, 'pk-env', process.env.SNOVA_PK_ENV || DEFAULT_SIGNER_ENV) || DEFAULT_SIGNER_ENV;
  switch (cmd) {
    case 'control':
      return await controlSummary(client, pkEnv, supernovaRegistry());
    case 'contracts': {
      const all = getBoolFlag(parsed, 'all');
      if (all) return { core: supernovaRegistry(), liveContracts: loadLiveContracts() };
      return { core: supernovaRegistry() };
    }
    case 'token':
      return await readTokenMeta(client, requirePositional(parsed, 1, 'token'));
    case 'balance':
      return await readBalance(client, requirePositional(parsed, 1, 'owner'), requirePositional(parsed, 2, 'asset'));
    case 'allowance':
      return await readAllowance(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'owner'), requirePositional(parsed, 3, 'spender'));
    case 'pair-v2':
      return await readPairV2(client, requirePositional(parsed, 1, 'tokenA'), requirePositional(parsed, 2, 'tokenB'), getBoolFlag(parsed, 'stable') ?? false);
    case 'pool-cl':
      return await readClPool(client, requirePositional(parsed, 1, 'tokenA'), requirePositional(parsed, 2, 'tokenB'));
    case 'gauge':
      return await readGauge(client, requirePositional(parsed, 1, 'pool'));
    case 'position':
      return await readPosition(client, BigInt(requirePositional(parsed, 1, 'tokenId')));
    case 'quote-v2': {
      const amount = getFlag(parsed, 'amount-in');
      if (!amount) throw new Error('Missing --amount-in');
      return await quoteV2(client, requirePositional(parsed, 1, 'tokenIn'), requirePositional(parsed, 2, 'tokenOut'), amount);
    }
    case 'approve-plan': {
      const amount = getFlag(parsed, 'amount');
      if (!amount) throw new Error('Missing --amount');
      const plan = await buildApprovePlan(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'spender'), amount);
      return await maybeAttachPreflight(client, logger, plan, pkEnv);
    }
    case 'swap-plan-v2': {
      const amount = getFlag(parsed, 'amount-in');
      const recipient = getFlag(parsed, 'recipient');
      if (!amount) throw new Error('Missing --amount-in');
      if (!recipient) throw new Error('Missing --recipient');
      const plan = await buildSwapPlanV2(client, requirePositional(parsed, 1, 'tokenIn'), requirePositional(parsed, 2, 'tokenOut'), amount, recipient, getBoolFlag(parsed, 'stable'), Number(getFlag(parsed, 'slippage-bps', '50')), Number(getFlag(parsed, 'deadline-sec', '1200')), getFlag(parsed, 'amount-out-min'));
      return await maybeAttachPreflight(client, logger, plan, pkEnv);
    }
    case 'swap-plan-eth-in-v2': {
      const amount = getFlag(parsed, 'amount-in-eth');
      const recipient = getFlag(parsed, 'recipient');
      if (!amount) throw new Error('Missing --amount-in-eth');
      if (!recipient) throw new Error('Missing --recipient');
      const plan = await buildSwapPlanEthInV2(client, requirePositional(parsed, 1, 'tokenOut'), amount, recipient, getBoolFlag(parsed, 'stable'), Number(getFlag(parsed, 'slippage-bps', '50')), Number(getFlag(parsed, 'deadline-sec', '1200')), getFlag(parsed, 'amount-out-min'));
      return await maybeAttachPreflight(client, logger, plan, pkEnv);
    }
    case 'swap-plan-eth-out-v2': {
      const amount = getFlag(parsed, 'amount-in');
      const recipient = getFlag(parsed, 'recipient');
      if (!amount) throw new Error('Missing --amount-in');
      if (!recipient) throw new Error('Missing --recipient');
      const plan = await buildSwapPlanEthOutV2(client, requirePositional(parsed, 1, 'tokenIn'), amount, recipient, getBoolFlag(parsed, 'stable'), Number(getFlag(parsed, 'slippage-bps', '50')), Number(getFlag(parsed, 'deadline-sec', '1200')), getFlag(parsed, 'amount-out-min'));
      return await maybeAttachPreflight(client, logger, plan, pkEnv);
    }
    case 'log-status': {
      const summary = logger.summarizeToday();
      return {
        deviceId: logger.deviceId,
        eventFile: logger.paths.eventFile,
        latestRuntimeSummaryJson: logger.paths.latestRuntimeSummaryJson,
        latestRuntimeSummaryMd: logger.paths.latestRuntimeSummaryMd,
        latestCloudSummaryJson: logger.paths.cloud.latestSummaryJsonPath,
        skillUpdatePromptPath: logger.paths.cloud.skillUpdatePromptPath,
        pendingSkillUpdate: existsSync(logger.paths.cloud.pendingSkillUpdatePath) ? JSON.parse(readFileSync(logger.paths.cloud.pendingSkillUpdatePath, 'utf8')) : null,
        summary,
      };
    }
    case 'log-summary':
      return logger.summarizeToday();
    case 'log-prompt':
      return {
        path: logger.paths.cloud.skillUpdatePromptPath,
        content: readPrompt(logger.paths.cloud.skillUpdatePromptPath),
      };
    case 'help':
      return {
        commands: [
          'snova control [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]',
          'snova contracts [--all]',
          'snova token <token>',
          'snova balance <owner> <asset|eth>',
          'snova allowance <token> <owner> <spender|alias>',
          'snova pair-v2 <tokenA> <tokenB> [--stable]',
          'snova pool-cl <tokenA> <tokenB>',
          'snova gauge <pool>',
          'snova position <tokenId>',
          'snova quote-v2 <tokenIn> <tokenOut> --amount-in <decimal>',
          'snova approve-plan <token> <spender|alias> --amount <decimal>',
          'snova swap-plan-v2 <tokenIn> <tokenOut> --amount-in <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]',
          'snova swap-plan-eth-in-v2 <tokenOut> --amount-in-eth <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]',
          'snova swap-plan-eth-out-v2 <tokenIn> --amount-in <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]',
          'snova log-status',
          'snova log-summary',
          'snova log-prompt',
        ],
        core: SUPERNOVA_CONTRACTS,
      };
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cmd = parsed.positionals[0];
  const logger = createEthMainnetLogger({
    skill: 'supernova-dex-mainnet',
    command: cmd || 'unknown',
  });
  const result = await logger.logCommand(cmd || 'unknown', {
    positionals: parsed.positionals.slice(1),
    flags: objectFromFlags(parsed.flags),
  }, async () => runCommand(parsed, logger));
  print(result);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exit(1);
});
