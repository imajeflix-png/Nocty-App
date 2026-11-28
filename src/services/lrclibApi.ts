import { LyricLine } from '../types/music';
import { cleanTrackMetaForLyrics, parseLrcLyrics } from '../utils/audioUtils';
import { reportApiTiming } from '../utils/networkTelemetry';

const LYRICS_CACHE_KEY = 'nocty_lyrics_cache_v1';
const LYRICS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LRCLIB_TIMEOUT_MS = 5000;

interface CachedLyricEntry {
  synced: LyricLine[];
  plain?: string;
  cachedAt: number;
}

interface LrcLibResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  trackName?: string;
  artistName?: string;
}

const memoryCache = new Map<string, CachedLyricEntry>();

function isFreshEntry(entry: CachedLyricEntry | undefined, now = Date.now()): boolean {
  return Boolean(entry && typeof entry.cachedAt === 'number' && now - entry.cachedAt < LYRICS_CACHE_TTL_MS);
}

function readLocalCache(): Record<string, CachedLyricEntry> {
  try {
    const raw = localStorage.getItem(LYRICS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const fresh: Record<string, CachedLyricEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isFreshEntry(v as CachedLyricEntry, now)) {
        fresh[k] = v as CachedLyricEntry;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function writeLocalCache(key: string, entry: CachedLyricEntry): void {
  memoryCache.set(key, entry);
  try {
    const existing = readLocalCache();
    existing[key] = entry;
    // Keep cache compact (max 60 songs)
    const keys = Object.keys(existing);
    if (keys.length > 60) {
      keys
        .sort((a, b) => existing[a].cachedAt - existing[b].cachedAt)
        .slice(0, keys.length - 60)
        .forEach((oldKey) => delete existing[oldKey]);
    }
    localStorage.setItem(LYRICS_CACHE_KEY, JSON.stringify(existing));
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchLrcWithTimeout(url: string, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const startedAt = Date.now();
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, LRCLIB_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, { signal: controller.signal });
    reportApiTiming(Date.now() - startedAt, false);
    return res;
  } catch (err) {
    if (timedOut && !externalSignal?.aborted) {
      reportApiTiming(Date.now() - startedAt, true);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

async function queryLrcLibGet(
  artist: string,
  title: string,
  duration?: number,
  signal?: AbortSignal
): Promise<LrcLibResponse | null> {
  const durParam = duration && duration > 0 ? `&duration=${Math.round(duration)}` : '';
  const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}${durParam}`;
  const res = await fetchLrcWithTimeout(url, signal);
  if (!res.ok) return null;
  return (await res.json()) as LrcLibResponse;
}

async function queryLrcLibSearch(query: string, signal?: AbortSignal): Promise<LrcLibResponse | null> {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
  const res = await fetchLrcWithTimeout(url, signal);
  if (!res.ok) return null;
  const list = (await res.json()) as LrcLibResponse[];
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.find((item) => Boolean(item.syncedLyrics)) || list[0] || null;
}

export async function fetchSyncedLyrics(
  artist: string,
  title: string,
  duration?: number,
  signal?: AbortSignal
): Promise<{ synced: LyricLine[]; plain?: string }> {
  const cleaned = cleanTrackMetaForLyrics(artist, title);
  const cacheKey = `${cleaned.artist.toLowerCase()}::${cleaned.title.toLowerCase()}`;

  const memHit = memoryCache.get(cacheKey);
  if (isFreshEntry(memHit)) {
    return { synced: memHit!.synced, plain: memHit!.plain };
  }

  const diskCache = readLocalCache();
  if (isFreshEntry(diskCache[cacheKey])) {
    memoryCache.set(cacheKey, diskCache[cacheKey]);
    return { synced: diskCache[cacheKey].synced, plain: diskCache[cacheKey].plain };
  }

  let match: LrcLibResponse | null = null;

  try {
    // 1. Try exact cleaned artist + title + duration
    match = await queryLrcLibGet(cleaned.artist, cleaned.title, duration, signal);

    // 2. Try raw artist + cleaned title if different
    if (!match || (!match.syncedLyrics && !match.plainLyrics)) {
      match = await queryLrcLibGet(artist.trim(), cleaned.title, duration, signal);
    }

    // 3. Fallback to LRCLIB search endpoint for partial/collaborative matches
    if (!match || (!match.syncedLyrics && !match.plainLyrics)) {
      const searchHit = await queryLrcLibSearch(`${cleaned.artist} ${cleaned.title}`, signal);
      if (searchHit) match = searchHit;
    }

    // 4. Fallback title-only search
    if ((!match || (!match.syncedLyrics && !match.plainLyrics)) && cleaned.title.length >= 3) {
      const titleOnlyHit = await queryLrcLibSearch(cleaned.title, signal);
      if (titleOnlyHit) match = titleOnlyHit;
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  const synced = match?.syncedLyrics ? parseLrcLyrics(match.syncedLyrics) : [];
  const plain = match?.plainLyrics?.trim() || undefined;

  const entry: CachedLyricEntry = {
    synced,
    plain,
    cachedAt: Date.now(),
  };
  writeLocalCache(cacheKey, entry);

  return { synced, plain };
}
