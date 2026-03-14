#!/usr/bin/env node
import { controlSummary, createEthClient, DEFAULT_SIGNER_ENV } from '../../../src/core/eth.js';
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
  if (['1','true','yes','y'].includes(text)) return true;
  if (['0','false','no','n'].includes(text)) return false;
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

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cmd = parsed.positionals[0];
  if (!cmd) throw new Error('Missing command');
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  switch (cmd) {
    case 'network':
      print(await controlSummary(client, getFlag(parsed, 'pk-env', process.env.SNOVA_PK_ENV || DEFAULT_SIGNER_ENV), supernovaRegistry()));
    case 'control':
      print(await controlSummary(client, getFlag(parsed, 'pk-env', process.env.SNOVA_PK_ENV || DEFAULT_SIGNER_ENV), supernovaRegistry()));
    case 'contracts': {
      const all = getBoolFlag(parsed, 'all');
      if (all) print({ core: supernovaRegistry(), liveContracts: loadLiveContracts() });
      print({ core: supernovaRegistry() });
    }
    case 'token':
      print(await readTokenMeta(client, requirePositional(parsed, 1, 'token')));
    case 'balance':
      print(await readBalance(client, requirePositional(parsed, 1, 'owner'), requirePositional(parsed, 2, 'asset')));
    case 'allowance':
      print(await readAllowance(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'owner'), requirePositional(parsed, 3, 'spender')));
    case 'pair-v2':
      print(await readPairV2(client, requirePositional(parsed, 1, 'tokenA'), requirePositional(parsed, 2, 'tokenB'), getBoolFlag(parsed, 'stable') ?? false));
    case 'pool-cl':
      print(await readClPool(client, requirePositional(parsed, 1, 'tokenA'), requirePositional(parsed, 2, 'tokenB')));
    case 'gauge':
      print(await readGauge(client, requirePositional(parsed, 1, 'pool')));
    case 'position':
      print(await readPosition(client, BigInt(requirePositional(parsed, 1, 'tokenId'))));
    case 'quote-v2': {
      const amount = getFlag(parsed, 'amount-in');
      if (!amount) throw new Error('Missing --amount-in');
      print(await quoteV2(client, requirePositional(parsed, 1, 'tokenIn'), requirePositional(parsed, 2, 'tokenOut'), amount));
    }
    case 'approve-plan': {
      const amount = getFlag(parsed, 'amount');
      if (!amount) throw new Error('Missing --amount');
      print(await buildApprovePlan(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'spender'), amount));
    }
    case 'swap-plan-v2': {
      const amount = getFlag(parsed, 'amount-in');
      const recipient = getFlag(parsed, 'recipient');
      if (!amount) throw new Error('Missing --amount-in');
      if (!recipient) throw new Error('Missing --recipient');
      print(await buildSwapPlanV2(client, requirePositional(parsed, 1, 'tokenIn'), requirePositional(parsed, 2, 'tokenOut'), amount, recipient, getBoolFlag(parsed, 'stable'), Number(getFlag(parsed, 'slippage-bps', '50')), Number(getFlag(parsed, 'deadline-sec', '1200')), getFlag(parsed, 'amount-out-min')));
    }
    case 'swap-plan-eth-in-v2': {
      const amount = getFlag(parsed, 'amount-in-eth');
      const recipient = getFlag(parsed, 'recipient');
      if (!amount) throw new Error('Missing --amount-in-eth');
      if (!recipient) throw new Error('Missing --recipient');
      print(await buildSwapPlanEthInV2(client, requirePositional(parsed, 1, 'tokenOut'), amount, recipient, getBoolFlag(parsed, 'stable'), Number(getFlag(parsed, 'slippage-bps', '50')), Number(getFlag(parsed, 'deadline-sec', '1200')), getFlag(parsed, 'amount-out-min')));
    }
    case 'swap-plan-eth-out-v2': {
      const amount = getFlag(parsed, 'amount-in');
      const recipient = getFlag(parsed, 'recipient');
      if (!amount) throw new Error('Missing --amount-in');
      if (!recipient) throw new Error('Missing --recipient');
      print(await buildSwapPlanEthOutV2(client, requirePositional(parsed, 1, 'tokenIn'), amount, recipient, getBoolFlag(parsed, 'stable'), Number(getFlag(parsed, 'slippage-bps', '50')), Number(getFlag(parsed, 'deadline-sec', '1200')), getFlag(parsed, 'amount-out-min')));
    }
    case 'help':
      print({
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
          'snova swap-plan-eth-out-v2 <tokenIn> --amount-in <decimal> --recipient <address> [--stable] [--slippage-bps 50] [--deadline-sec 1200] [--amount-out-min <decimal>]'
        ],
        core: SUPERNOVA_CONTRACTS,
      });
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exit(1);
});
