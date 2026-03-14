import type { Address, Hex } from 'viem';

export type LogStatus = 'ok' | 'error' | 'pending' | 'success' | 'replaced';
export type LogKind = 'command' | 'step' | 'tx-preflight' | 'tx-broadcast' | 'tx-replaced' | 'tx-receipt' | 'tx-error' | 'logger-error';

export type LogEvent = {
  id: string;
  ts: string;
  date: string;
  unixMs: number;
  deviceId: string;
  sessionKey: string | null;
  chainId: 1;
  skill: string;
  command: string;
  kind: LogKind;
  status: LogStatus;
  tags: string[];
  txKey?: string;
  hash?: Hex;
  details: Record<string, unknown>;
};

export type LoggerOptions = {
  repoRoot?: string;
  deviceId?: string;
  sessionKey?: string | null;
  skill: string;
  command?: string;
};

export type LogSummary = {
  date: string;
  deviceId: string;
  totalEvents: number;
  commandOk: number;
  commandError: number;
  txPreflights: number;
  txBroadcasts: number;
  txReceiptsSuccess: number;
  txReceiptsFailed: number;
  txErrors: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  medianLatencyMs: number | null;
  avgEstimatedMaxFeePerGasGwei: number | null;
  avgEstimatedPriorityFeeGwei: number | null;
  avgEffectiveGasPriceGwei: number | null;
  avgEstimatedTotalFeeEth: number | null;
  avgEstimatedTotalFeeUsd: number | null;
  avgActualFeeEth: number | null;
  avgActualFeeUsd: number | null;
  lastError: string | null;
  lastUpdatedAt: string | null;
};

export type TxPlanLike = {
  to: Address;
  value?: string;
  data: Hex;
  action?: string;
  approvalTarget?: Address | null;
};
