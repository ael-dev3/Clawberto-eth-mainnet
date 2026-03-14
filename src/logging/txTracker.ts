import { formatEther, formatGwei, type Address, type Hex, type PublicClient } from 'viem';
import type { EthMainnetLogger } from './logger.js';
import { getEthUsdQuote } from './priceFeed.js';

export type TrackRequest = {
  account?: Address;
  to?: Address;
  value?: bigint;
  data?: Hex;
  label?: string;
  tags?: string[];
  extra?: Record<string, unknown>;
};

function txKey() {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function maybe<T>(value: T | null | undefined, map: (value: T) => unknown) {
  return value === null || value === undefined ? null : map(value);
}

function feeUsdFromWei(valueWei: bigint | null, priceUsd: number | null) {
  if (valueWei === null || priceUsd === null) return null;
  const eth = Number(formatEther(valueWei));
  return Number.isFinite(eth) ? eth * priceUsd : null;
}

export async function capturePreflight(logger: EthMainnetLogger, client: PublicClient, request: TrackRequest) {
  const key = txKey();
  let baseFeePerGas: bigint | null = null;
  let maxFeePerGas: bigint | null = null;
  let maxPriorityFeePerGas: bigint | null = null;
  let gasEstimate: bigint | null = null;
  let feeHistoryBaseFees: string[] | null = null;
  let feeEstimateError: string | null = null;
  let baseFeeError: string | null = null;
  let feeHistoryError: string | null = null;
  let gasEstimateError: string | null = null;
  try {
    const fees = await client.estimateFeesPerGas();
    maxFeePerGas = fees.maxFeePerGas ?? null;
    maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? null;
  } catch (error) {
    feeEstimateError = error instanceof Error ? error.message : String(error);
    logger.loggerError(error, 'estimateFeesPerGas');
  }
  try {
    const block = await client.getBlock();
    baseFeePerGas = block.baseFeePerGas ?? null;
  } catch (error) {
    baseFeeError = error instanceof Error ? error.message : String(error);
    logger.loggerError(error, 'getBlock(baseFeePerGas)');
  }
  try {
    const history = await client.getFeeHistory({ blockCount: 4, rewardPercentiles: [25, 50, 75] });
    feeHistoryBaseFees = history.baseFeePerGas.map((v) => v.toString());
  } catch (error) {
    feeHistoryError = error instanceof Error ? error.message : String(error);
    logger.loggerError(error, 'getFeeHistory');
  }
  try {
    if (request.account && request.to) {
      gasEstimate = await client.estimateGas({
        account: request.account,
        to: request.to,
        value: request.value ?? 0n,
        data: request.data,
      });
    }
  } catch (error) {
    gasEstimateError = error instanceof Error ? error.message : String(error);
    logger.loggerError(error, 'estimateGas');
  }
  const estimatedTotalFeeWei = gasEstimate !== null && maxFeePerGas !== null ? gasEstimate * maxFeePerGas : null;
  const ethUsdQuote = await getEthUsdQuote(logger);
  const estimatedTotalFeeUsd = feeUsdFromWei(estimatedTotalFeeWei, ethUsdQuote.priceUsd);
  const event = logger.appendEvent({
    kind: 'tx-preflight',
    status: 'ok',
    txKey: key,
    tags: ['tx', 'preflight', ...(request.tags || [])],
    details: {
      label: request.label || null,
      account: request.account || null,
      to: request.to || null,
      valueWei: (request.value ?? 0n).toString(),
      baseFeePerGasWei: baseFeePerGas?.toString() ?? null,
      baseFeePerGasGwei: maybe(baseFeePerGas, (v) => formatGwei(v)),
      maxFeePerGasWei: maxFeePerGas?.toString() ?? null,
      maxFeePerGasGwei: maybe(maxFeePerGas, (v) => formatGwei(v)),
      maxPriorityFeePerGasWei: maxPriorityFeePerGas?.toString() ?? null,
      maxPriorityFeePerGasGwei: maybe(maxPriorityFeePerGas, (v) => formatGwei(v)),
      gasEstimate: gasEstimate?.toString() ?? null,
      gasEstimateError,
      estimatedTotalFeeWei: estimatedTotalFeeWei?.toString() ?? null,
      estimatedTotalFeeEth: maybe(estimatedTotalFeeWei, (v) => formatEther(v)),
      estimatedTotalFeeUsd,
      ethPriceUsd: ethUsdQuote.priceUsd,
      ethPriceSource: ethUsdQuote.source,
      ethPriceFetchedAt: ethUsdQuote.fetchedAt,
      ethPriceStale: ethUsdQuote.stale,
      ethPriceCacheAgeMs: ethUsdQuote.cacheAgeMs,
      ethPriceError: ethUsdQuote.error,
      feeHistoryBaseFees,
      feeEstimateError,
      baseFeeError,
      feeHistoryError,
      ...request.extra,
    },
  });
  return {
    txKey: key,
    eventId: event.id,
    startedAtMs: event.unixMs,
    gasEstimate,
    gasEstimateError,
    feeEstimateError,
    baseFeeError,
    feeHistoryError,
    baseFeePerGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    estimatedTotalFeeWei,
    estimatedTotalFeeUsd,
    ethUsdQuote,
  };
}

export function logBroadcast(logger: EthMainnetLogger, preflight: { txKey: string }, hash: Hex, extra: Record<string, unknown> = {}) {
  return logger.appendEvent({
    kind: 'tx-broadcast',
    status: 'pending',
    txKey: preflight.txKey,
    hash,
    tags: ['tx', 'broadcast'],
    details: {
      hash,
      ...extra,
    },
  });
}

export async function waitForTrackedReceipt(logger: EthMainnetLogger, client: PublicClient, preflight: { txKey: string; startedAtMs: number }, hash: Hex, extra: Record<string, unknown> = {}) {
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      onReplaced: (replacement) => {
        logger.appendEvent({
          kind: 'tx-replaced',
          status: 'replaced',
          txKey: preflight.txKey,
          hash: replacement.transaction.hash,
          tags: ['tx', 'replacement'],
          details: {
            reason: replacement.reason,
            replacedHash: replacement.replacedTransaction.hash,
            replacementHash: replacement.transaction.hash,
          },
        });
      },
    });
    const latencyMs = Date.now() - preflight.startedAtMs;
    const actualFeeWei = receipt.gasUsed * receipt.effectiveGasPrice;
    const ethUsdQuote = await getEthUsdQuote(logger);
    const actualFeeUsd = feeUsdFromWei(actualFeeWei, ethUsdQuote.priceUsd);
    logger.appendEvent({
      kind: 'tx-receipt',
      status: receipt.status === 'success' ? 'success' : 'error',
      txKey: preflight.txKey,
      hash: receipt.transactionHash,
      tags: ['tx', 'receipt'],
      details: {
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPriceWei: receipt.effectiveGasPrice.toString(),
        effectiveGasPriceGwei: formatGwei(receipt.effectiveGasPrice),
        actualFeeWei: actualFeeWei.toString(),
        actualFeeEth: formatEther(actualFeeWei),
        actualFeeUsd,
        ethPriceUsd: ethUsdQuote.priceUsd,
        ethPriceSource: ethUsdQuote.source,
        ethPriceFetchedAt: ethUsdQuote.fetchedAt,
        ethPriceStale: ethUsdQuote.stale,
        ethPriceCacheAgeMs: ethUsdQuote.cacheAgeMs,
        ethPriceError: ethUsdQuote.error,
        latencyMs,
        ...extra,
      },
    });
    return receipt;
  } catch (error) {
    logger.appendEvent({
      kind: 'tx-error',
      status: 'error',
      txKey: preflight.txKey,
      hash,
      tags: ['tx', 'error'],
      details: {
        message: error instanceof Error ? error.message : String(error),
        ...extra,
      },
    });
    throw error;
  }
}

export async function trackTransactionExecution<T extends Hex>(opts: {
  logger: EthMainnetLogger;
  client: PublicClient;
  request: TrackRequest;
  send: () => Promise<T>;
  extra?: Record<string, unknown>;
}) {
  const preflight = await capturePreflight(opts.logger, opts.client, opts.request);
  const hash = await opts.send();
  logBroadcast(opts.logger, preflight, hash, opts.extra || {});
  const receipt = await waitForTrackedReceipt(opts.logger, opts.client, preflight, hash, opts.extra || {});
  return {
    hash,
    receipt,
    preflight,
  };
}
