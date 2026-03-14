import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const ETH_MAINNET_CHAIN_ID = 1;
export const DEFAULT_RPC_URL = process.env.ETH_MAINNET_RPC_URL || 'https://ethereum.publicnode.com';
export const DEFAULT_SIGNER_ENV = process.env.ETH_MAINNET_PK_ENV || 'ETH_MAINNET_EXEC_PRIVATE_KEY';
export const ZERO = zeroAddress;

export const MAINNET_ALIASES = {
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
} as const;

export type TokenMeta = {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
};

export function createEthClient(rpcUrl = DEFAULT_RPC_URL) {
  return createPublicClient({
    transport: http(rpcUrl),
  });
}

export function clientRpcUrl(client: PublicClient) {
  return ((client.transport as unknown as { url?: string }).url) || DEFAULT_RPC_URL;
}

export function isNativeEth(value: string) {
  return value.trim().toLowerCase() === 'eth';
}

export function resolveAliasOrAddress(value: string, aliases: Record<string, string> = MAINNET_ALIASES): Address {
  const key = value.trim().toLowerCase();
  if (key in aliases) return getAddress(aliases[key]) as Address;
  return getAddress(value.trim()) as Address;
}

export async function networkSummary(client: PublicClient) {
  const [chainId, blockNumber] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
  return {
    rpcUrl: clientRpcUrl(client),
    chainId: String(chainId),
    blockNumber: blockNumber.toString(),
    ok: chainId === ETH_MAINNET_CHAIN_ID,
  };
}

export async function readSigner(client: PublicClient, pkEnv = DEFAULT_SIGNER_ENV) {
  const privateKey = String(process.env[pkEnv] || '').trim();
  const [chainId] = await Promise.all([client.getChainId()]);
  if (!privateKey) {
    return {
      pkEnv,
      ready: false,
      reason: `missing env var: ${pkEnv}`,
      address: null,
      chainId: String(chainId),
      rpcUrl: clientRpcUrl(client),
      ethBalanceRaw: null,
      ethBalance: null,
    };
  }
  const account = privateKeyToAccount(privateKey as Hex);
  const balance = await client.getBalance({ address: account.address });
  return {
    pkEnv,
    ready: true,
    reason: null,
    address: account.address,
    chainId: String(chainId),
    rpcUrl: clientRpcUrl(client),
    ethBalanceRaw: balance.toString(),
    ethBalance: formatEther(balance),
  };
}

export async function controlSummary(client: PublicClient, pkEnv = DEFAULT_SIGNER_ENV, extraContracts: Record<string, Address> = {}) {
  const [network, signer] = await Promise.all([networkSummary(client), readSigner(client, pkEnv)]);
  return {
    mode: 'eth-mainnet-control',
    network,
    signer,
    defaults: {
      rpcEnv: 'ETH_MAINNET_RPC_URL',
      pkEnv,
      ...extraContracts,
    },
  };
}

export async function readTokenMeta(client: PublicClient, tokenIn: string, aliases: Record<string, string> = MAINNET_ALIASES): Promise<TokenMeta> {
  const token = resolveAliasOrAddress(tokenIn, aliases);
  const [symbol, name, decimals] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'name' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  return {
    address: token,
    symbol,
    name,
    decimals: Number(decimals),
  };
}

export async function readBalance(client: PublicClient, ownerIn: string, assetIn: string, aliases: Record<string, string> = MAINNET_ALIASES) {
  const owner = resolveAliasOrAddress(ownerIn, aliases);
  if (isNativeEth(assetIn)) {
    const balance = await client.getBalance({ address: owner });
    return {
      owner,
      asset: 'ETH',
      address: ZERO,
      symbol: 'ETH',
      decimals: 18,
      balanceRaw: balance.toString(),
      balance: formatEther(balance),
    };
  }
  const token = await readTokenMeta(client, assetIn, aliases);
  const balance = await client.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  });
  return {
    owner,
    asset: token.symbol,
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
    balanceRaw: balance.toString(),
    balance: formatUnits(balance, token.decimals),
  };
}

export async function readAllowance(client: PublicClient, tokenIn: string, ownerIn: string, spenderIn: string, aliases: Record<string, string> = MAINNET_ALIASES) {
  if (isNativeEth(tokenIn)) throw new Error('ETH does not use ERC20 allowance');
  const token = await readTokenMeta(client, tokenIn, aliases);
  const owner = resolveAliasOrAddress(ownerIn, aliases);
  const spender = resolveAliasOrAddress(spenderIn, aliases);
  const allowance = await client.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  });
  return {
    token,
    owner,
    spender,
    allowanceRaw: allowance.toString(),
    allowance: formatUnits(allowance, token.decimals),
  };
}

export async function buildApprovePlan(client: PublicClient, tokenIn: string, spenderIn: string, amountDecimal: string, aliases: Record<string, string> = MAINNET_ALIASES) {
  const token = await readTokenMeta(client, tokenIn, aliases);
  const spender = resolveAliasOrAddress(spenderIn, aliases);
  const amount = parseUnits(amountDecimal, token.decimals);
  return {
    action: 'approve-plan',
    token,
    spender,
    amountRaw: amount.toString(),
    amount: amountDecimal,
    to: token.address,
    value: '0',
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount],
    }),
  };
}
