import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LogEvent, LogSummary } from './types.js';

export type CloudSyncPaths = {
  repoRoot: string;
  cloudRoot: string;
  deviceId: string;
  latestEventPath: string;
  latestSummaryJsonPath: string;
  latestSummaryMdPath: string;
  skillUpdatePromptPath: string;
  pendingSkillUpdatePath: string;
};

function ensureDirFor(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function writeJson(path: string, value: unknown) {
  ensureDirFor(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string) {
  ensureDirFor(path);
  writeFileSync(path, value);
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function createSkillUpdatePrompt(event: LogEvent, summary: LogSummary) {
  return [
    '# ETH Mainnet Skill Update Prompt',
    '',
    'A new telemetry event was recorded. If the observation reflects durable behavior, update the GitHub skill/docs with the new data.',
    '',
    `- device: ${event.deviceId}`,
    `- timestamp: ${event.ts}`,
    `- skill: ${event.skill}`,
    `- command: ${event.command}`,
    `- event kind: ${event.kind}`,
    `- status: ${event.status}`,
    '',
    '## Latest event details',
    '```json',
    JSON.stringify(event.details, null, 2),
    '```',
    '',
    '## Daily summary snapshot',
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
    '',
    '## Action',
    '- Review whether this changed operational reality, gas behavior, latency expectations, failure modes, or best practices.',
    '- If yes, update the repo skill/docs and keep the note compact and device-agnostic where possible.',
    '',
  ].join('\n');
}

export function writeCloudArtifacts(paths: CloudSyncPaths, event: LogEvent, summary: LogSummary) {
  writeJson(paths.latestEventPath, event);
  writeJson(paths.latestSummaryJsonPath, summary);
  writeText(paths.latestSummaryMdPath, [
    '# ETH Mainnet Latest Summary',
    '',
    `- device: ${summary.deviceId}`,
    `- date: ${summary.date}`,
    `- total events: ${summary.totalEvents}`,
    `- tx success rate: ${summary.successRate === null ? 'n/a' : `${(summary.successRate * 100).toFixed(2)}%`}`,
    `- avg latency ms: ${summary.avgLatencyMs === null ? 'n/a' : summary.avgLatencyMs.toFixed(0)}`,
    `- avg effective gas gwei: ${summary.avgEffectiveGasPriceGwei === null ? 'n/a' : summary.avgEffectiveGasPriceGwei.toFixed(3)}`,
    `- avg estimated fee USD: ${summary.avgEstimatedTotalFeeUsd === null ? 'n/a' : summary.avgEstimatedTotalFeeUsd.toFixed(6)}`,
    `- avg actual fee USD: ${summary.avgActualFeeUsd === null ? 'n/a' : summary.avgActualFeeUsd.toFixed(6)}`,
    `- last updated: ${summary.lastUpdatedAt || 'n/a'}`,
    '',
  ].join('\n'));
  const prompt = createSkillUpdatePrompt(event, summary);
  writeText(paths.skillUpdatePromptPath, prompt);
  const pending = readJson(paths.pendingSkillUpdatePath, {
    deviceId: paths.deviceId,
    count: 0,
    lastEventId: null,
    lastUpdatedAt: null,
  } as { deviceId: string; count: number; lastEventId: string | null; lastUpdatedAt: string | null });
  pending.count += 1;
  pending.lastEventId = event.id;
  pending.lastUpdatedAt = event.ts;
  writeJson(paths.pendingSkillUpdatePath, pending);
}

export function maybeAutoGitSync(paths: CloudSyncPaths, ts: string) {
  if (String(process.env.ETH_MAINNET_AUTO_GIT_SYNC || '').toLowerCase() !== '1') return { synced: false, reason: 'disabled' };
  const minIntervalSec = Number(process.env.ETH_MAINNET_GIT_SYNC_INTERVAL_SEC || '300');
  const statePath = resolve(paths.cloudRoot, 'git-sync-state.json');
  const state = readJson(statePath, { lastSyncUnixMs: 0 });
  const nowMs = Date.now();
  if (nowMs - Number(state.lastSyncUnixMs || 0) < minIntervalSec * 1000) {
    return { synced: false, reason: 'debounced' };
  }
  try {
    execFileSync('git', ['-C', paths.repoRoot, 'add', '-f', paths.cloudRoot], { stdio: 'ignore' });
    const staged = execFileSync('git', ['-C', paths.repoRoot, 'diff', '--cached', '--name-only', '--', paths.cloudRoot], { encoding: 'utf8' }).trim();
    if (!staged) return { synced: false, reason: 'no-changes' };
    execFileSync('git', ['-C', paths.repoRoot, 'commit', '-m', `chore(telemetry): sync eth-mainnet ${paths.deviceId} ${ts}`], { stdio: 'ignore' });
    execFileSync('git', ['-C', paths.repoRoot, 'push', 'origin', 'main'], { stdio: 'ignore' });
    writeJson(statePath, { lastSyncUnixMs: nowMs, lastSyncAt: ts });
    return { synced: true, reason: null };
  } catch (error) {
    return { synced: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
