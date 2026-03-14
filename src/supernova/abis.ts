import { parseAbi } from 'viem';

export const routerV2Abi = parseAbi([
  'function pairFor(address,address,bool) view returns (address)',
  'function getReserves(address,address,bool) view returns (uint256,uint256)',
  'function getPoolAmountOut(uint256,address,address) view returns (uint256)',
  'function quoteAddLiquidity(address,address,bool,uint256,uint256) view returns (uint256,uint256,uint256)',
  'function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,(address pair,address from,address to,bool stable,bool concentrated,address receiver)[] routes,address to,uint256 deadline) returns (uint256[] amounts)',
  'function swapExactETHForTokens(uint256 amountOutMin,(address pair,address from,address to,bool stable,bool concentrated,address receiver)[] routes,address to,uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactTokensForETH(uint256 amountIn,uint256 amountOutMin,(address pair,address from,address to,bool stable,bool concentrated,address receiver)[] routes,address to,uint256 deadline) returns (uint256[] amounts)',
]);

export const pairFactoryAbi = parseAbi([
  'function getPair(address,address,bool) view returns (address)',
  'function getFee(address,bool) view returns (uint256)',
  'function isPair(address) view returns (bool)',
  'function allPairsLength() view returns (uint256)',
]);

export const pairAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function reserve0() view returns (uint256)',
  'function reserve1() view returns (uint256)',
]);

export const factoryClAbi = parseAbi([
  'function poolByPair(address,address) view returns (address)',
  'function allPairsLength() view returns (uint256)',
]);

export const clPoolAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function tickSpacing() view returns (int24)',
  'function getReserves() view returns (uint128,uint128)',
  'function safelyGetStateOfAMM() view returns (uint160,int24,uint16,uint8,uint128,int24,int24)',
]);

export const gaugeManagerAbi = parseAbi([
  'function gauges(address) view returns (address)',
  'function isGaugeAliveForPool(address) view returns (bool)',
  'function fetchInternalBribeFromPool(address) view returns (address)',
  'function fetchExternalBribeFromPool(address) view returns (address)',
  'function pairFactory() view returns (address)',
  'function pairFactoryCL() view returns (address)',
  'function voter() view returns (address)',
]);

export const voterAbi = parseAbi([
  'function weights(address) view returns (uint256)',
  'function totalWeight() view returns (uint256)',
  'function getEpochTotalWeight(uint256) view returns (uint256)',
  'function getEpochPoolWeight(uint256,address) view returns (uint256)',
]);

export const gaugeAbi = parseAbi([
  'function rewardRate() view returns (uint256)',
  'function rewardForDuration() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function totalActiveSupply() view returns (uint256)',
]);

export const nfpmAbi = parseAbi([
  'function positions(uint256 tokenId) view returns (uint88 nonce,address operator,address token0,address token1,address deployer,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function tokenFarmedIn(uint256 tokenId) view returns (address)',
  'function farmingApprovals(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);
