import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maybeAutoGitSync, writeCloudArtifacts, type CloudSyncPaths } from './githubSync.js';
import { loadEventsFromJsonl, summarizeEvents, summaryToMarkdown } from './metrics.js';
import type { LogEvent, LoggerOptions } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_REPO_ROOT = resolve(__dirname, '../..');

function now() {
  const d = new Date();
  return {
    ts: d.toISOString(),
    date: d.toISOString().slice(0, 10),
    unixMs: d.getTime(),
  };
}

function sanitizeDeviceId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-device';
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export type EthMainnetLogger = {
  repoRoot: string;
  deviceId: string;
  sessionKey: string | null;
  skill: string;
  command: string;
  paths: ReturnType<typeof buildPaths>;
  appendEvent: (partial: Omit<LogEvent, 'id' | 'ts' | 'date' | 'unixMs' | 'deviceId' | 'sessionKey' | 'chainId' | 'skill' | 'command'> & { command?: string; skill?: string }) => LogEvent;
  logCommand: <T>(command: string, details: Record<string, unknown>, fn: () => Promise<T>) => Promise<T>;
  logStep: (status: 'ok' | 'error' | 'pending' | 'success' | 'replaced', details: Record<string, unknown>, kind?: LogEvent['kind']) => LogEvent;
  summarizeToday: () => ReturnType<typeof summarizeToday>;
  loggerError: (error: unknown, context: string) => void;
};

function buildPaths(repoRoot: string, deviceId: string) {
  const runtimeRoot = resolve(repoRoot, 'runtime/eth-mainnet/devices', deviceId);
  const cloudRoot = resolve(repoRoot, 'cloud/eth-mainnet');
  const { date } = now();
  return {
    repoRoot,
    runtimeRoot,
    eventFile: resolve(runtimeRoot, 'events', `${date}.jsonl`),
    loggerErrorFile: resolve(runtimeRoot, 'logger-errors.jsonl'),
    stateFile: resolve(runtimeRoot, 'state.json'),
    latestRuntimeSummaryMd: resolve(runtimeRoot, 'latest-summary.md'),
    latestRuntimeSummaryJson: resolve(runtimeRoot, 'latest-summary.json'),
    cloud: {
      repoRoot,
      cloudRoot,
      deviceId,
      latestEventPath: resolve(cloudRoot, 'devices', deviceId, 'latest-event.json'),
      latestSummaryJsonPath: resolve(cloudRoot, 'devices', deviceId, 'latest-summary.json'),
      latestSummaryMdPath: resolve(cloudRoot, 'devices', deviceId, 'latest-summary.md'),
      skillUpdatePromptPath: resolve(cloudRoot, 'skill-update-prompt.md'),
      pendingSkillUpdatePath: resolve(cloudRoot, 'pending-skill-update.json'),
    } satisfies CloudSyncPaths,
  };
}

function summarizeToday(paths: ReturnType<typeof buildPaths>, deviceId: string) {
  const { date } = now();
  const events = existsSync(paths.eventFile) ? loadEventsFromJsonl(paths.eventFile) : [];
  const summary = summarizeEvents(events, date, deviceId);
  writeJson(paths.latestRuntimeSummaryJson, summary);
  writeFileSync(paths.latestRuntimeSummaryMd, summaryToMarkdown(summary));
  return summary;
}

function updateState(paths: ReturnType<typeof buildPaths>, event: LogEvent) {
  const state = readJson(paths.stateFile, {
    deviceId: event.deviceId,
    lastEventId: null,
    lastEventAt: null,
    eventCount: 0,
  } as { deviceId: string; lastEventId: string | null; lastEventAt: string | null; eventCount: number });
  state.lastEventId = event.id;
  state.lastEventAt = event.ts;
  state.eventCount += 1;
  writeJson(paths.stateFile, state);
}

export function createEthMainnetLogger(options: LoggerOptions): EthMainnetLogger {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const deviceId = sanitizeDeviceId(options.deviceId || process.env.ETH_MAINNET_DEVICE_ID || hostname());
  const sessionKey = options.sessionKey ?? process.env.OPENCLAW_SESSION_KEY ?? process.env.SESSION_KEY ?? null;
  const skill = options.skill;
  const command = options.command || 'unknown';
  const paths = buildPaths(repoRoot, deviceId);
  mkdirSync(dirname(paths.eventFile), { recursive: true });
  mkdirSync(dirname(paths.loggerErrorFile), { recursive: true });

  function loggerError(error: unknown, context: string) {
    const stamp = now();
    const entry = {
      id: randomId(),
      ...stamp,
      deviceId,
      sessionKey,
      chainId: 1,
      skill,
      command,
      kind: 'logger-error',
      status: 'error',
      tags: ['logger'],
      details: {
        context,
        message: error instanceof Error ? error.message : String(error),
      },
    } satisfies LogEvent;
    try {
      appendFileSync(paths.loggerErrorFile, `${JSON.stringify(entry)}\n`);
    } catch {
      // swallow completely
    }
  }

  function appendEvent(partial: Omit<LogEvent, 'id' | 'ts' | 'date' | 'unixMs' | 'deviceId' | 'sessionKey' | 'chainId' | 'skill' | 'command'> & { command?: string; skill?: string }): LogEvent {
    const stamp = now();
    const event: LogEvent = {
      id: randomId(),
      ...stamp,
      deviceId,
      sessionKey,
      chainId: 1,
      skill: partial.skill || skill,
      command: partial.command || command,
      kind: partial.kind,
      status: partial.status,
      tags: partial.tags || [],
      txKey: partial.txKey,
      hash: partial.hash,
      details: partial.details,
    };
    try {
      appendFileSync(paths.eventFile, `${JSON.stringify(event)}\n`);
      updateState(paths, event);
      const summary = summarizeToday(paths, deviceId);
      writeCloudArtifacts(paths.cloud, event, summary);
      maybeAutoGitSync(paths.cloud, event.ts);
    } catch (error) {
      loggerError(error, 'appendEvent');
    }
    return event;
  }

  function logStep(status: 'ok' | 'error' | 'pending' | 'success' | 'replaced', details: Record<string, unknown>, kind: LogEvent['kind'] = 'step') {
    return appendEvent({ kind, status, tags: ['step'], details });
  }

  async function logCommand<T>(commandName: string, details: Record<string, unknown>, fn: () => Promise<T>) {
    const startedAt = Date.now();
    appendEvent({ command: commandName, kind: 'command', status: 'pending', tags: ['command'], details: { phase: 'start', ...details } });
    try {
      const result = await fn();
      appendEvent({ command: commandName, kind: 'command', status: 'ok', tags: ['command'], details: { phase: 'finish', durationMs: Date.now() - startedAt, ...details } });
      return result;
    } catch (error) {
      appendEvent({ command: commandName, kind: 'command', status: 'error', tags: ['command', 'error'], details: { phase: 'finish', durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : String(error), ...details } });
      throw error;
    }
  }

  return {
    repoRoot,
    deviceId,
    sessionKey,
    skill,
    command,
    paths,
    appendEvent,
    logCommand,
    logStep,
    summarizeToday: () => summarizeToday(paths, deviceId),
    loggerError,
  };
}
