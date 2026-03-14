import { formatEther, formatGwei } from 'viem';
import type { LogSummary } from './types.js';

type PreflightLike = {
  txKey: string;
  gasEstimate?: bigint | null;
  gasEstimateError?: string | null;
  feeEstimateError?: string | null;
  baseFeeError?: string | null;
  feeHistoryError?: string | null;
  baseFeePerGas?: bigint | null;
  maxFeePerGas?: bigint | null;
  maxPriorityFeePerGas?: bigint | null;
  estimatedTotalFeeWei?: bigint | null;
  estimatedTotalFeeUsd?: number | null;
  ethUsdQuote: {
    priceUsd: number | null;
    source: string | null;
    fetchedAt: string | null;
    stale: boolean;
    cacheAgeMs: number | null;
    error: string | null;
  };
};

export function formatDecimal(value: number | null, decimals: number) {
  if (value === null || !Number.isFinite(value)) return null;
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function presentSummary(summary: LogSummary) {
  return {
    ...summary,
    avgEstimatedMaxFeePerGasGwei: formatDecimal(summary.avgEstimatedMaxFeePerGasGwei, 9),
    avgEstimatedPriorityFeeGwei: formatDecimal(summary.avgEstimatedPriorityFeeGwei, 9),
    avgEffectiveGasPriceGwei: formatDecimal(summary.avgEffectiveGasPriceGwei, 9),
    avgEstimatedTotalFeeEth: formatDecimal(summary.avgEstimatedTotalFeeEth, 18),
    avgEstimatedTotalFeeUsd: formatDecimal(summary.avgEstimatedTotalFeeUsd, 6),
    avgActualFeeEth: formatDecimal(summary.avgActualFeeEth, 18),
    avgActualFeeUsd: formatDecimal(summary.avgActualFeeUsd, 6),
  };
}

export function presentPreflight(preflight: PreflightLike) {
  return {
    available: true,
    txKey: preflight.txKey,
    gasEstimate: preflight.gasEstimate?.toString() ?? null,
    gasEstimateError: preflight.gasEstimateError ?? null,
    feeEstimateError: preflight.feeEstimateError ?? null,
    baseFeeError: preflight.baseFeeError ?? null,
    feeHistoryError: preflight.feeHistoryError ?? null,
    baseFeePerGasGwei: preflight.baseFeePerGas ? formatGwei(preflight.baseFeePerGas) : null,
    maxFeePerGasGwei: preflight.maxFeePerGas ? formatGwei(preflight.maxFeePerGas) : null,
    maxPriorityFeePerGasGwei: preflight.maxPriorityFeePerGas ? formatGwei(preflight.maxPriorityFeePerGas) : null,
    estimatedTotalFeeWei: preflight.estimatedTotalFeeWei?.toString() ?? null,
    estimatedTotalFeeEth: preflight.estimatedTotalFeeWei ? formatEther(preflight.estimatedTotalFeeWei) : null,
    estimatedTotalFeeUsd: preflight.estimatedTotalFeeUsd ?? null,
    ethPriceUsd: preflight.ethUsdQuote.priceUsd,
    ethPriceSource: preflight.ethUsdQuote.source,
    ethPriceFetchedAt: preflight.ethUsdQuote.fetchedAt,
    ethPriceStale: preflight.ethUsdQuote.stale,
    ethPriceCacheAgeMs: preflight.ethUsdQuote.cacheAgeMs,
    ethPriceError: preflight.ethUsdQuote.error,
  };
}
