import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type PublicClient,
} from 'viem';
import { MAINNET_ALIASES, buildApprovePlan as buildGenericApprovePlan, isNativeEth, readAllowance as readGenericAllowance, readBalance as readGenericBalance, readTokenMeta as readGenericTokenMeta, resolveAliasOrAddress } from '../core/eth.js';
import { SUPERNOVA_ALIASES, SUPERNOVA_CONTRACTS } from '../generated/contracts.js';
import { clPoolAbi, factoryClAbi, gaugeAbi, gaugeManagerAbi, nfpmAbi, pairAbi, pairFactoryAbi, routerV2Abi, voterAbi } from './abis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const WEEK = 7 * 24 * 60 * 60;

export function epochStart(tsSec: number) {
  return tsSec - (tsSec % WEEK);
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function supernovaRegistry() {
  return Object.fromEntries(Object.entries(SUPERNOVA_CONTRACTS).map(([k, v]) => [k, getAddress(v) as Address]));
}

export function loadLiveContracts(): Array<{ address: Address; name: string }> {
  const path = resolve(REPO_ROOT, 'metadata/live_contracts_eth_mainnet.json');
  const raw = stripBom(readFileSync(path, 'utf8'));
  const parsed = JSON.parse(raw) as Array<{ address: string; name?: string }>;
  return parsed.map((item) => ({ address: getAddress(item.address) as Address, name: item.name || '' }));
}

async function readPairQuote(client: PublicClient, amountIn: bigint, tokenIn: Address, pair: Address, decimalsOut: number) {
  if (pair === zeroAddress) {
    return {
      quoteAvailable: false,
      quoteError: 'pair does not exist',
      quotedAmountOutRaw: null,
      quotedAmountOut: null,
    };
  }
  try {
    const quoted = await client.readContract({
      address: SUPERNOVA_CONTRACTS.routerv2,
      abi: routerV2Abi,
      functionName: 'getPoolAmountOut',
      args: [amountIn, tokenIn, pair],
    });
    return {
      quoteAvailable: true,
      quoteError: null,
      quotedAmountOutRaw: quoted.toString(),
      quotedAmountOut: formatUnits(quoted, decimalsOut),
    };
  } catch (error) {
    return {
      quoteAvailable: false,
      quoteError: error instanceof Error ? error.message : String(error),
      quotedAmountOutRaw: null,
      quotedAmountOut: null,
    };
  }
}

function chooseStableFlag(stableArg: boolean | null, volatilePair: Address, stablePair: Address) {
  const hasVolatile = volatilePair !== zeroAddress;
  const hasStable = stablePair !== zeroAddress;
  if (stableArg !== null) {
    return {
      stable: stableArg,
      warning: hasVolatile && hasStable ? 'both stable and volatile pairs exist; forced route selected' : null,
    };
  }
  if (hasVolatile && hasStable) {
    throw new Error('Both stable and volatile pairs exist; pass --stable true|false for deterministic route selection');
  }
  if (hasStable) return { stable: true, warning: null };
  return { stable: false, warning: null };
}

async function resolveV2Route(client: PublicClient, tokenIn: Address, tokenOut: Address, stableArg: boolean | null) {
  const [volatilePairRaw, stablePairRaw] = await Promise.all([
    client.readContract({ address: SUPERNOVA_CONTRACTS.pairfactory, abi: pairFactoryAbi, functionName: 'getPair', args: [tokenIn, tokenOut, false] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.pairfactory, abi: pairFactoryAbi, functionName: 'getPair', args: [tokenIn, tokenOut, true] }),
  ]);
  const volatilePair = getAddress(volatilePairRaw) as Address;
  const stablePair = getAddress(stablePairRaw) as Address;
  const chosen = chooseStableFlag(stableArg, volatilePair, stablePair);
  const pair = chosen.stable ? stablePair : volatilePair;
  if (pair === zeroAddress) {
    throw new Error(`No ${chosen.stable ? 'stable' : 'volatile'} V2 pair exists for the requested token pair`);
  }
  return { pair, volatilePair, stablePair, chosen };
}

export async function readTokenMeta(client: PublicClient, tokenIn: string) {
  return readGenericTokenMeta(client, tokenIn, SUPERNOVA_ALIASES);
}

export async function readBalance(client: PublicClient, ownerIn: string, assetIn: string) {
  return readGenericBalance(client, ownerIn, assetIn, SUPERNOVA_ALIASES);
}

export async function readAllowance(client: PublicClient, tokenIn: string, ownerIn: string, spenderIn: string) {
  return readGenericAllowance(client, tokenIn, ownerIn, spenderIn, SUPERNOVA_ALIASES);
}

export async function readPairV2(client: PublicClient, tokenAIn: string, tokenBIn: string, stable: boolean) {
  const tokenA = await readTokenMeta(client, tokenAIn);
  const tokenB = await readTokenMeta(client, tokenBIn);
  const [pairRaw, routerPairRaw] = await Promise.all([
    client.readContract({ address: SUPERNOVA_CONTRACTS.pairfactory, abi: pairFactoryAbi, functionName: 'getPair', args: [tokenA.address, tokenB.address, stable] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.routerv2, abi: routerV2Abi, functionName: 'pairFor', args: [tokenA.address, tokenB.address, stable] }),
  ]);
  const pair = getAddress(pairRaw) as Address;
  const routerPair = getAddress(routerPairRaw) as Address;
  if (pair === zeroAddress) {
    return { tokenA, tokenB, token0: null, token1: null, stable, pair, routerPair, feeRaw: null, reserve0Raw: null, reserve1Raw: null, reserve0: null, reserve1: null };
  }
  const [fee, token0Addr, token1Addr, reserve0, reserve1] = await Promise.all([
    client.readContract({ address: SUPERNOVA_CONTRACTS.pairfactory, abi: pairFactoryAbi, functionName: 'getFee', args: [pair, stable] }),
    client.readContract({ address: pair, abi: pairAbi, functionName: 'token0' }),
    client.readContract({ address: pair, abi: pairAbi, functionName: 'token1' }),
    client.readContract({ address: pair, abi: pairAbi, functionName: 'reserve0' }),
    client.readContract({ address: pair, abi: pairAbi, functionName: 'reserve1' }),
  ]);
  const [token0, token1] = await Promise.all([
    readTokenMeta(client, token0Addr),
    readTokenMeta(client, token1Addr),
  ]);
  return {
    tokenA,
    tokenB,
    token0,
    token1,
    stable,
    pair,
    routerPair,
    feeRaw: fee.toString(),
    reserve0Raw: reserve0.toString(),
    reserve1Raw: reserve1.toString(),
    reserve0: formatUnits(reserve0, token0.decimals),
    reserve1: formatUnits(reserve1, token1.decimals),
  };
}

export async function readClPool(client: PublicClient, tokenAIn: string, tokenBIn: string) {
  const tokenA = await readTokenMeta(client, tokenAIn);
  const tokenB = await readTokenMeta(client, tokenBIn);
  const poolRaw = await client.readContract({
    address: SUPERNOVA_CONTRACTS.factorycl,
    abi: factoryClAbi,
    functionName: 'poolByPair',
    args: [tokenA.address, tokenB.address],
  });
  const pool = getAddress(poolRaw) as Address;
  if (pool === zeroAddress) return { tokenA, tokenB, pool, exists: false };
  const [token0, token1, tickSpacing, reserves, amm] = await Promise.all([
    client.readContract({ address: pool, abi: clPoolAbi, functionName: 'token0' }),
    client.readContract({ address: pool, abi: clPoolAbi, functionName: 'token1' }),
    client.readContract({ address: pool, abi: clPoolAbi, functionName: 'tickSpacing' }),
    client.readContract({ address: pool, abi: clPoolAbi, functionName: 'getReserves' }),
    client.readContract({ address: pool, abi: clPoolAbi, functionName: 'safelyGetStateOfAMM' }),
  ]);
  return {
    tokenA,
    tokenB,
    pool,
    exists: true,
    token0: getAddress(token0) as Address,
    token1: getAddress(token1) as Address,
    tickSpacing: Number(tickSpacing),
    reserve0Raw: reserves[0].toString(),
    reserve1Raw: reserves[1].toString(),
    amm: {
      sqrtPriceX96: amm[0].toString(),
      tick: Number(amm[1]),
      lastFeeRaw: Number(amm[2]),
      pluginConfig: Number(amm[3]),
      activeLiquidityRaw: amm[4].toString(),
      nextTick: Number(amm[5]),
      previousTick: Number(amm[6]),
    },
  };
}

async function tryGaugeRead(client: PublicClient, gauge: Address, functionName: 'rewardRate' | 'rewardForDuration' | 'totalSupply' | 'totalActiveSupply') {
  try {
    const out = await client.readContract({ address: gauge, abi: gaugeAbi, functionName });
    return out.toString();
  } catch {
    return null;
  }
}

export async function readGauge(client: PublicClient, poolIn: string) {
  const pool = resolveAliasOrAddress(poolIn, SUPERNOVA_ALIASES);
  const epoch = epochStart(nowSec());
  const [gaugeRaw, alive, internalBribeRaw, externalBribeRaw, totalWeight, epochTotalWeight, weight, epochPoolWeight] = await Promise.all([
    client.readContract({ address: SUPERNOVA_CONTRACTS.gaugemanager, abi: gaugeManagerAbi, functionName: 'gauges', args: [pool] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.gaugemanager, abi: gaugeManagerAbi, functionName: 'isGaugeAliveForPool', args: [pool] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.gaugemanager, abi: gaugeManagerAbi, functionName: 'fetchInternalBribeFromPool', args: [pool] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.gaugemanager, abi: gaugeManagerAbi, functionName: 'fetchExternalBribeFromPool', args: [pool] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.voter, abi: voterAbi, functionName: 'totalWeight' }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.voter, abi: voterAbi, functionName: 'getEpochTotalWeight', args: [BigInt(epoch)] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.voter, abi: voterAbi, functionName: 'weights', args: [pool] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.voter, abi: voterAbi, functionName: 'getEpochPoolWeight', args: [BigInt(epoch), pool] }),
  ]);
  const gauge = getAddress(gaugeRaw) as Address;
  const rewardRateRaw = gauge !== zeroAddress ? await tryGaugeRead(client, gauge, 'rewardRate') : null;
  const rewardForDurationRaw = gauge !== zeroAddress ? await tryGaugeRead(client, gauge, 'rewardForDuration') : null;
  const totalSupplyRaw = gauge !== zeroAddress ? await tryGaugeRead(client, gauge, 'totalSupply') : null;
  const totalActiveSupplyRaw = gauge !== zeroAddress ? await tryGaugeRead(client, gauge, 'totalActiveSupply') : null;
  return {
    pool,
    gauge,
    alive,
    internalBribe: getAddress(internalBribeRaw) as Address,
    externalBribe: getAddress(externalBribeRaw) as Address,
    currentWeightRaw: weight.toString(),
    currentTotalWeightRaw: totalWeight.toString(),
    epochStart: epoch,
    epochPoolWeightRaw: epochPoolWeight.toString(),
    epochTotalWeightRaw: epochTotalWeight.toString(),
    rewardRateRaw,
    rewardForDurationRaw,
    totalSupplyRaw,
    totalActiveSupplyRaw,
  };
}

export async function readPosition(client: PublicClient, tokenId: bigint) {
  const [position, farmedIn, farmingApproval, owner] = await Promise.all([
    client.readContract({ address: SUPERNOVA_CONTRACTS.nfpm, abi: nfpmAbi, functionName: 'positions', args: [tokenId] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.nfpm, abi: nfpmAbi, functionName: 'tokenFarmedIn', args: [tokenId] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.nfpm, abi: nfpmAbi, functionName: 'farmingApprovals', args: [tokenId] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.nfpm, abi: nfpmAbi, functionName: 'ownerOf', args: [tokenId] }),
  ]);
  const token0Meta = await readTokenMeta(client, position[2]);
  const token1Meta = await readTokenMeta(client, position[3]);
  return {
    tokenId: tokenId.toString(),
    owner: getAddress(owner) as Address,
    farmedIn: getAddress(farmedIn) as Address,
    farmingApproval: getAddress(farmingApproval) as Address,
    token0: token0Meta,
    token1: token1Meta,
    deployer: getAddress(position[4]) as Address,
    tickLower: Number(position[5]),
    tickUpper: Number(position[6]),
    liquidityRaw: position[7].toString(),
    tokensOwed0Raw: position[10].toString(),
    tokensOwed1Raw: position[11].toString(),
    tokensOwed0: formatUnits(position[10], token0Meta.decimals),
    tokensOwed1: formatUnits(position[11], token1Meta.decimals),
  };
}

export async function quoteV2(client: PublicClient, tokenInArg: string, tokenOutArg: string, amountInDecimal: string) {
  const tokenIn = await readTokenMeta(client, tokenInArg);
  const tokenOut = await readTokenMeta(client, tokenOutArg);
  const amountIn = parseUnits(amountInDecimal, tokenIn.decimals);
  const [volatilePairRaw, stablePairRaw] = await Promise.all([
    client.readContract({ address: SUPERNOVA_CONTRACTS.pairfactory, abi: pairFactoryAbi, functionName: 'getPair', args: [tokenIn.address, tokenOut.address, false] }),
    client.readContract({ address: SUPERNOVA_CONTRACTS.pairfactory, abi: pairFactoryAbi, functionName: 'getPair', args: [tokenIn.address, tokenOut.address, true] }),
  ]);
  const volatilePair = getAddress(volatilePairRaw) as Address;
  const stablePair = getAddress(stablePairRaw) as Address;
  const [volatile, stable] = await Promise.all([
    readPairQuote(client, amountIn, tokenIn.address, volatilePair, tokenOut.decimals),
    readPairQuote(client, amountIn, tokenIn.address, stablePair, tokenOut.decimals),
  ]);
  const candidates = [
    { mode: 'volatile', pair: volatilePair, ...volatile },
    { mode: 'stable', pair: stablePair, ...stable },
  ].filter((item) => item.quoteAvailable);
  candidates.sort((a, b) => {
    const ax = BigInt(a.quotedAmountOutRaw || '0');
    const bx = BigInt(b.quotedAmountOutRaw || '0');
    return ax > bx ? -1 : ax < bx ? 1 : 0;
  });
  const best = candidates[0] || null;
  return {
    tokenIn,
    tokenOut,
    amountInRaw: amountIn.toString(),
    amountIn: amountInDecimal,
    quoteAvailable: best !== null,
    bestMode: best?.mode || null,
    bestPair: best?.pair || null,
    quotedAmountOutRaw: best?.quotedAmountOutRaw || null,
    quotedAmountOut: best?.quotedAmountOut || null,
    volatile: { pair: volatilePair, ...volatile },
    stable: { pair: stablePair, ...stable },
  };
}

export async function buildApprovePlan(client: PublicClient, tokenIn: string, spenderIn: string, amountDecimal: string) {
  return buildGenericApprovePlan(client, tokenIn, spenderIn, amountDecimal, SUPERNOVA_ALIASES);
}

export async function buildSwapPlanV2(client: PublicClient, tokenInArg: string, tokenOutArg: string, amountInDecimal: string, recipientArg: string, stableArg: boolean | null, slippageBps: number, deadlineSec: number, amountOutMinDecimal?: string) {
  const tokenIn = await readTokenMeta(client, tokenInArg);
  const tokenOut = await readTokenMeta(client, tokenOutArg);
  const recipient = resolveAliasOrAddress(recipientArg, MAINNET_ALIASES);
  const amountIn = parseUnits(amountInDecimal, tokenIn.decimals);
  const { pair, chosen } = await resolveV2Route(client, tokenIn.address, tokenOut.address, stableArg);
  let quoted: bigint | null = null;
  let amountOutMin: bigint;
  let warning: string | null = chosen.warning;
  if (amountOutMinDecimal !== undefined) {
    amountOutMin = parseUnits(amountOutMinDecimal, tokenOut.decimals);
    warning = warning || 'amountOutMin provided manually; router quote skipped';
  } else {
    quoted = await client.readContract({ address: SUPERNOVA_CONTRACTS.routerv2, abi: routerV2Abi, functionName: 'getPoolAmountOut', args: [amountIn, tokenIn.address, pair] });
    amountOutMin = quoted * BigInt(Math.max(0, 10_000 - slippageBps)) / 10_000n;
  }
  const deadline = BigInt(nowSec() + deadlineSec);
  const routes = [{ pair, from: tokenIn.address, to: tokenOut.address, stable: chosen.stable, concentrated: false, receiver: recipient }];
  return {
    action: 'swap-plan-v2',
    to: SUPERNOVA_CONTRACTS.routerv2,
    value: '0',
    data: encodeFunctionData({ abi: routerV2Abi, functionName: 'swapExactTokensForTokens', args: [amountIn, amountOutMin, routes, recipient, deadline] }),
    tokenIn,
    tokenOut,
    recipient,
    stable: chosen.stable,
    pair,
    amountInRaw: amountIn.toString(),
    amountIn: amountInDecimal,
    quotedBestAmountOutRaw: quoted?.toString() || null,
    quotedBestAmountOut: quoted !== null ? formatUnits(quoted, tokenOut.decimals) : null,
    amountOutMinRaw: amountOutMin.toString(),
    amountOutMin: formatUnits(amountOutMin, tokenOut.decimals),
    slippageBps,
    deadline: deadline.toString(),
    approvalTarget: SUPERNOVA_CONTRACTS.routerv2,
    warning,
  };
}

export async function buildSwapPlanEthInV2(client: PublicClient, tokenOutArg: string, amountInEth: string, recipientArg: string, stableArg: boolean | null, slippageBps: number, deadlineSec: number, amountOutMinDecimal?: string) {
  const tokenOut = await readTokenMeta(client, tokenOutArg);
  const recipient = resolveAliasOrAddress(recipientArg, MAINNET_ALIASES);
  const amountIn = parseUnits(amountInEth, 18);
  const { pair, chosen } = await resolveV2Route(client, SUPERNOVA_CONTRACTS.weth, tokenOut.address, stableArg);
  let quoted: bigint | null = null;
  let amountOutMin: bigint;
  let warning: string | null = chosen.warning;
  if (amountOutMinDecimal !== undefined) {
    amountOutMin = parseUnits(amountOutMinDecimal, tokenOut.decimals);
    warning = warning || 'amountOutMin provided manually; router quote skipped';
  } else {
    quoted = await client.readContract({ address: SUPERNOVA_CONTRACTS.routerv2, abi: routerV2Abi, functionName: 'getPoolAmountOut', args: [amountIn, SUPERNOVA_CONTRACTS.weth, pair] });
    amountOutMin = quoted * BigInt(Math.max(0, 10_000 - slippageBps)) / 10_000n;
  }
  const deadline = BigInt(nowSec() + deadlineSec);
  const routes = [{ pair, from: SUPERNOVA_CONTRACTS.weth, to: tokenOut.address, stable: chosen.stable, concentrated: false, receiver: recipient }];
  return {
    action: 'swap-plan-eth-in-v2',
    to: SUPERNOVA_CONTRACTS.routerv2,
    value: amountIn.toString(),
    data: encodeFunctionData({ abi: routerV2Abi, functionName: 'swapExactETHForTokens', args: [amountOutMin, routes, recipient, deadline] }),
    tokenIn: { address: zeroAddress as Address, symbol: 'ETH', name: 'Ether', decimals: 18 },
    tokenOut,
    recipient,
    stable: chosen.stable,
    pair,
    amountInRaw: amountIn.toString(),
    amountIn: amountInEth,
    quotedBestAmountOutRaw: quoted?.toString() || null,
    quotedBestAmountOut: quoted !== null ? formatUnits(quoted, tokenOut.decimals) : null,
    amountOutMinRaw: amountOutMin.toString(),
    amountOutMin: formatUnits(amountOutMin, tokenOut.decimals),
    slippageBps,
    deadline: deadline.toString(),
    approvalTarget: null,
    warning,
  };
}

export async function buildSwapPlanEthOutV2(client: PublicClient, tokenInArg: string, amountInDecimal: string, recipientArg: string, stableArg: boolean | null, slippageBps: number, deadlineSec: number, amountOutMinDecimal?: string) {
  const tokenIn = await readTokenMeta(client, tokenInArg);
  const recipient = resolveAliasOrAddress(recipientArg, MAINNET_ALIASES);
  const amountIn = parseUnits(amountInDecimal, tokenIn.decimals);
  const { pair, chosen } = await resolveV2Route(client, tokenIn.address, SUPERNOVA_CONTRACTS.weth, stableArg);
  let quoted: bigint | null = null;
  let amountOutMin: bigint;
  let warning: string | null = chosen.warning;
  if (amountOutMinDecimal !== undefined) {
    amountOutMin = parseUnits(amountOutMinDecimal, 18);
    warning = warning || 'amountOutMin provided manually; router quote skipped';
  } else {
    quoted = await client.readContract({ address: SUPERNOVA_CONTRACTS.routerv2, abi: routerV2Abi, functionName: 'getPoolAmountOut', args: [amountIn, tokenIn.address, pair] });
    amountOutMin = quoted * BigInt(Math.max(0, 10_000 - slippageBps)) / 10_000n;
  }
  const deadline = BigInt(nowSec() + deadlineSec);
  const routes = [{ pair, from: tokenIn.address, to: SUPERNOVA_CONTRACTS.weth, stable: chosen.stable, concentrated: false, receiver: recipient }];
  return {
    action: 'swap-plan-eth-out-v2',
    to: SUPERNOVA_CONTRACTS.routerv2,
    value: '0',
    data: encodeFunctionData({ abi: routerV2Abi, functionName: 'swapExactTokensForETH', args: [amountIn, amountOutMin, routes, recipient, deadline] }),
    tokenIn,
    tokenOut: { address: zeroAddress as Address, symbol: 'ETH', name: 'Ether', decimals: 18 },
    recipient,
    stable: chosen.stable,
    pair,
    amountInRaw: amountIn.toString(),
    amountIn: amountInDecimal,
    quotedBestAmountOutRaw: quoted?.toString() || null,
    quotedBestAmountOut: quoted !== null ? formatEther(quoted) : null,
    amountOutMinRaw: amountOutMin.toString(),
    amountOutMin: formatEther(amountOutMin),
    slippageBps,
    deadline: deadline.toString(),
    approvalTarget: SUPERNOVA_CONTRACTS.routerv2,
    warning,
  };
}

export { isNativeEth };
