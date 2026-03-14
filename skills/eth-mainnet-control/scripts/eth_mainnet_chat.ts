#!/usr/bin/env node
import { buildApprovePlan, controlSummary, createEthClient, DEFAULT_SIGNER_ENV, MAINNET_ALIASES, networkSummary, readAllowance, readBalance, readSigner, readTokenMeta, resolveAliasOrAddress } from '../../../src/core/eth.js';

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

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cmd = parsed.positionals[0];
  if (!cmd) throw new Error('Missing command');
  const client = createEthClient(process.env.ETH_MAINNET_RPC_URL);
  switch (cmd) {
    case 'network':
      print(await networkSummary(client));
    case 'control':
      print(await controlSummary(client, getFlag(parsed, 'pk-env', process.env.ETH_MAINNET_PK_ENV || DEFAULT_SIGNER_ENV), MAINNET_ALIASES));
    case 'signer':
      print(await readSigner(client, getFlag(parsed, 'pk-env', process.env.ETH_MAINNET_PK_ENV || DEFAULT_SIGNER_ENV)));
    case 'token':
      print(await readTokenMeta(client, requirePositional(parsed, 1, 'token'), MAINNET_ALIASES));
    case 'balance':
      print(await readBalance(client, requirePositional(parsed, 1, 'owner'), requirePositional(parsed, 2, 'asset'), MAINNET_ALIASES));
    case 'allowance':
      print(await readAllowance(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'owner'), requirePositional(parsed, 3, 'spender'), MAINNET_ALIASES));
    case 'approve-plan': {
      const amount = getFlag(parsed, 'amount');
      if (!amount) throw new Error('Missing --amount');
      print(await buildApprovePlan(client, requirePositional(parsed, 1, 'token'), requirePositional(parsed, 2, 'spender'), amount, MAINNET_ALIASES));
    }
    case 'alias':
      print({ value: requirePositional(parsed, 1, 'alias'), resolved: resolveAliasOrAddress(requirePositional(parsed, 1, 'alias'), MAINNET_ALIASES) });
    case 'help':
      print({
        commands: [
          'eth network',
          'eth control [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]',
          'eth signer [--pk-env ETH_MAINNET_EXEC_PRIVATE_KEY]',
          'eth token <token>',
          'eth balance <owner> <asset|eth>',
          'eth allowance <token> <owner> <spender|alias>',
          'eth approve-plan <token> <spender|alias> --amount <decimal>',
          'eth alias <alias|address>'
        ],
        aliases: MAINNET_ALIASES,
      });
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  process.exit(1);
});
