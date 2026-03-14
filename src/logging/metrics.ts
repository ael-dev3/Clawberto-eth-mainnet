import { readFileSync } from 'node:fs';
import type { LogEvent, LogSummary } from './types.js';

export function loadEventsFromJsonl(path: string): LogEvent[] {
  const text = readFileSync(path, 'utf8').trim();
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LogEvent);
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function summarizeEvents(events: LogEvent[], date: string, deviceId: string): LogSummary {
  const commandOk = events.filter((e) => e.kind === 'command' && e.status === 'ok').length;
  const commandError = events.filter((e) => e.kind === 'command' && e.status === 'error').length;
  const txPreflights = events.filter((e) => e.kind === 'tx-preflight').length;
  const txBroadcasts = events.filter((e) => e.kind === 'tx-broadcast').length;
  const txReceipts = events.filter((e) => e.kind === 'tx-receipt');
  const txReceiptsSuccess = txReceipts.filter((e) => String(e.details.status) === 'success').length;
  const txReceiptsFailed = txReceipts.filter((e) => String(e.details.status) !== 'success').length;
  const txErrors = events.filter((e) => e.kind === 'tx-error').length;
  const latencyValues = txReceipts
    .map((e) => toNumberOrNull(e.details.latencyMs))
    .filter((v): v is number => v !== null);
  const estimatedMaxFeeValues = events
    .filter((e) => e.kind === 'tx-preflight')
    .map((e) => toNumberOrNull(e.details.maxFeePerGasGwei))
    .filter((v): v is number => v !== null);
  const estimatedPriorityValues = events
    .filter((e) => e.kind === 'tx-preflight')
    .map((e) => toNumberOrNull(e.details.maxPriorityFeePerGasGwei))
    .filter((v): v is number => v !== null);
  const effectiveGasValues = txReceipts
    .map((e) => toNumberOrNull(e.details.effectiveGasPriceGwei))
    .filter((v): v is number => v !== null);
  const estimatedFeeValues = events
    .filter((e) => e.kind === 'tx-preflight')
    .map((e) => toNumberOrNull(e.details.estimatedTotalFeeEth))
    .filter((v): v is number => v !== null);
  const actualFeeValues = txReceipts
    .map((e) => toNumberOrNull(e.details.actualFeeEth))
    .filter((v): v is number => v !== null);
  const lastErrorEvent = [...events].reverse().find((e) => e.status === 'error' || e.kind === 'tx-error' || e.kind === 'logger-error');
  const successDenominator = txReceiptsSuccess + txReceiptsFailed + txErrors;
  return {
    date,
    deviceId,
    totalEvents: events.length,
    commandOk,
    commandError,
    txPreflights,
    txBroadcasts,
    txReceiptsSuccess,
    txReceiptsFailed,
    txErrors,
    successRate: successDenominator > 0 ? txReceiptsSuccess / successDenominator : null,
    avgLatencyMs: average(latencyValues),
    medianLatencyMs: median(latencyValues),
    avgEstimatedMaxFeePerGasGwei: average(estimatedMaxFeeValues),
    avgEstimatedPriorityFeeGwei: average(estimatedPriorityValues),
    avgEffectiveGasPriceGwei: average(effectiveGasValues),
    avgEstimatedTotalFeeEth: average(estimatedFeeValues),
    avgActualFeeEth: average(actualFeeValues),
    lastError: lastErrorEvent ? String(lastErrorEvent.details.message || lastErrorEvent.details.error || 'unknown error') : null,
    lastUpdatedAt: events.length ? events[events.length - 1].ts : null,
  };
}

export function summaryToMarkdown(summary: LogSummary) {
  return [
    `# ETH Mainnet Daily Summary`,
    '',
    `- date: ${summary.date}`,
    `- device: ${summary.deviceId}`,
    `- total events: ${summary.totalEvents}`,
    `- command ok/error: ${summary.commandOk}/${summary.commandError}`,
    `- tx preflights/broadcasts: ${summary.txPreflights}/${summary.txBroadcasts}`,
    `- tx receipts success/failed: ${summary.txReceiptsSuccess}/${summary.txReceiptsFailed}`,
    `- tx errors: ${summary.txErrors}`,
    `- success rate: ${summary.successRate === null ? 'n/a' : `${(summary.successRate * 100).toFixed(2)}%`}`,
    `- avg latency ms: ${summary.avgLatencyMs === null ? 'n/a' : summary.avgLatencyMs.toFixed(0)}`,
    `- median latency ms: ${summary.medianLatencyMs === null ? 'n/a' : summary.medianLatencyMs.toFixed(0)}`,
    `- avg estimated max fee gwei: ${summary.avgEstimatedMaxFeePerGasGwei === null ? 'n/a' : summary.avgEstimatedMaxFeePerGasGwei.toFixed(3)}`,
    `- avg estimated priority fee gwei: ${summary.avgEstimatedPriorityFeeGwei === null ? 'n/a' : summary.avgEstimatedPriorityFeeGwei.toFixed(3)}`,
    `- avg effective gas price gwei: ${summary.avgEffectiveGasPriceGwei === null ? 'n/a' : summary.avgEffectiveGasPriceGwei.toFixed(3)}`,
    `- avg estimated total fee ETH: ${summary.avgEstimatedTotalFeeEth === null ? 'n/a' : summary.avgEstimatedTotalFeeEth.toFixed(8)}`,
    `- avg actual fee ETH: ${summary.avgActualFeeEth === null ? 'n/a' : summary.avgActualFeeEth.toFixed(8)}`,
    `- last error: ${summary.lastError || 'none'}`,
    `- last updated: ${summary.lastUpdatedAt || 'n/a'}`,
    '',
  ].join('\n');
}
