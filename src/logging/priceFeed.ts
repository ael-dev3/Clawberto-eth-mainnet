import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EthMainnetLogger } from './logger.js';

const DEFAULT_QUOTE_TTL_MS = Math.max(1_000, Number(process.env.ETH_MAINNET_USD_QUOTE_TTL_MS || '300000'));
const DEFAULT_QUOTE_TIMEOUT_MS = Math.max(500, Number(process.env.ETH_MAINNET_USD_QUOTE_TIMEOUT_MS || '4000'));
const COINGECKO_ETH_USD_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

type CachedEthUsdQuote = {
  priceUsd: number;
  fetchedAt: string;
  source: string;
};

export type EthUsdQuote = {
  priceUsd: number | null;
  source: string | null;
  fetchedAt: string | null;
  stale: boolean;
  cacheAgeMs: number | null;
  error: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function readCachedQuote(path: string): CachedEthUsdQuote | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<CachedEthUsdQuote>;
    if (typeof parsed.priceUsd !== 'number' || !Number.isFinite(parsed.priceUsd)) return null;
    if (typeof parsed.fetchedAt !== 'string' || !parsed.fetchedAt) return null;
    return {
      priceUsd: parsed.priceUsd,
      fetchedAt: parsed.fetchedAt,
      source: typeof parsed.source === 'string' && parsed.source ? parsed.source : 'cache',
    };
  } catch {
    return null;
  }
}

function writeCachedQuote(path: string, quote: CachedEthUsdQuote) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(quote, null, 2)}\n`);
}

function cacheAgeMs(fetchedAt: string) {
  const parsed = Date.parse(fetchedAt);
  return Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : null;
}

function normalizeQuote(quote: CachedEthUsdQuote, stale: boolean, error: string | null): EthUsdQuote {
  return {
    priceUsd: quote.priceUsd,
    source: quote.source,
    fetchedAt: quote.fetchedAt,
    stale,
    cacheAgeMs: cacheAgeMs(quote.fetchedAt),
    error,
  };
}

export async function getEthUsdQuote(logger: EthMainnetLogger): Promise<EthUsdQuote> {
  const overrideRaw = String(process.env.ETH_MAINNET_USD_PRICE_OVERRIDE || '').trim();
  if (overrideRaw) {
    const priceUsd = Number(overrideRaw);
    if (Number.isFinite(priceUsd) && priceUsd > 0) {
      return {
        priceUsd,
        source: 'env-override',
        fetchedAt: nowIso(),
        stale: false,
        cacheAgeMs: 0,
        error: null,
      };
    }
  }

  const cachePath = logger.paths.priceCacheFile;
  const cached = readCachedQuote(cachePath);
  if (cached) {
    const ageMs = cacheAgeMs(cached.fetchedAt);
    if (ageMs !== null && ageMs <= DEFAULT_QUOTE_TTL_MS) {
      return normalizeQuote(cached, false, null);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_QUOTE_TIMEOUT_MS);
  try {
    const res = await fetch(COINGECKO_ETH_USD_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`ETH/USD quote HTTP ${res.status}`);
    }
    const data = await res.json() as { ethereum?: { usd?: unknown } };
    const priceUsd = Number(data?.ethereum?.usd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      throw new Error('ETH/USD quote payload missing ethereum.usd');
    }
    const quote: CachedEthUsdQuote = {
      priceUsd,
      fetchedAt: nowIso(),
      source: 'coingecko',
    };
    writeCachedQuote(cachePath, quote);
    return normalizeQuote(quote, false, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.loggerError(error, 'getEthUsdQuote');
    if (cached) return normalizeQuote(cached, true, message);
    return {
      priceUsd: null,
      source: null,
      fetchedAt: null,
      stale: false,
      cacheAgeMs: null,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
