#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { buildApprovePlan, controlSummary, createEthClient, DEFAULT_SIGNER_ENV, MAINNET_ALIASES, networkSummary, readAllowance, readBalance, readSigner, readTokenMeta, resolveAliasOrAddress } from '../../../src/core/eth.js';
import { createEthMainnetLogger } from '../../../src/logging/logger.js';
import { presentPreflight, presentSummary } from '../../../src/logging/presentation.js';
import { capturePreflight } from '../../../src/logging/txTracker.js';
import type { TxPlanLike } from '../../../src/logging/types.js';

type ParsedArgs = { positionals: string[]; flags: Map<string, string | true> };

function tokenize(argv: string[]) {
  const raw = argv.length === 1 ? argv[0].trim() : argv.join(' ').trim();
  return raw.split(/\s+/).filter(Boolean);
}

function parseArgs(argv: string[]): ParsedArgs {
  const tokens = tokenize(argv);
  if (tokens[0] === 'eth' || tokens[0] === '/eth') tokens.shift();
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
    tags: ['plan'],
  });
  return {
    ...payload,
    preflight: presentPreflight(preflight),
  };
}

async function runCommand(parsed: ParsedArgs, logger: ReturnType<typeof createEthMainnetLogger>) {
  const cmd = parsed.positionals[0];
  if (!cmd) throw new Error('Missing command');
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  const pkEnv = getFlag(parsed, 'pk-env', process.env.ETH_MAINNET_PK_ENV || DEFAULT_SIGNER_ENV) || DEFAULT_SIGNER_ENV;
  switch (cmd) {
    case 'network':
      return await networkSummary(client);
    case 'control':
      return await controlSummary(client, pkEnv, MAINNET_ALIASES);
    case 'signer':
      return await readSigner(client, pkEnv);
    case 'token':
      return await readTokenMeta(client, requirePositional(parsed, 1, 'token'), MAINNET_ALIASES);
    case 'balance':
      return await readBalance(client, requirePositional(parsed, 1, 'owner'), requirePositional(parsed, 2, 'asset'), MAINNET_ALIASES);
    case 'allowance':
      return await readAllowance(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'owner'), requirePositional(parsed, 3, 'spender'), MAINNET_ALIASES);
    case 'approve-plan': {
      const amount = getFlag(parsed, 'amount');
      if (!amount) throw new Error('Missing --amount');
      const plan = await buildApprovePlan(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'spender'), amount, MAINNET_ALIASES);
      return await maybeAttachPreflight(client, logger, plan, pkEnv);
    }
    case 'alias':
      return { value: requirePositional(parsed, 1, 'alias'), resolved: resolveAliasOrAddress(requirePositional(parsed, 1, 'alias'), MAINNET_ALIASES) };
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
        summary: presentSummary(summary),
      };
    }
    case 'log-summary':
      return presentSummary(logger.summarizeToday());
    case 'log-prompt':
      return {
        path: logger.paths.cloud.skillUpdatePromptPath,
        content: readPrompt(logger.paths.cloud.skillUpdatePromptPath),
      };
    case 'help':
      return {
        commands: [
          'eth network',
          'eth control [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]',
          'eth signer [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]',
          'eth token <token>',
          'eth balance <owner> <asset|eth>',
          'eth allowance <token> <owner> <spender|alias>',
          'eth approve-plan <token> <spender|alias> --amount <decimal>',
          'eth alias <alias|address>',
          'eth log-status',
          'eth log-summary',
          'eth log-prompt',
        ],
        aliases: MAINNET_ALIASES,
      };
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cmd = parsed.positionals[0];
  const logger = createEthMainnetLogger({
    skill: 'eth-mainnet-control',
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
