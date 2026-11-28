import { Track } from '../types/music';
import { DEFAULT_COVER_URL } from '../data/moods';
import {
  getCurrentNetworkMode,
  reportApiTiming,
  resizeCoverUrlForMode,
} from '../utils/networkTelemetry';

const CACHE_TTL_24H_MS = 24 * 60 * 60 * 1000;
const SEARCH_CACHE_KEY = 'nocty_search_cache_v2';
const CURATED_CACHE_KEY = 'nocty_curated_cache_v1';
const STREAM_CACHE_KEY = 'nocty_stream_cache_v1';
const MAX_API_TIMEOUT_MS = 5000;

interface CachedSearchEntry {
  tracks: Track[];
  cachedAt: number;
}

interface CachedCuratedEntry {
  indonesia: Track[];
  global: Track[];
  viral: Track[];
  indieRnb: Track[];
  cachedAt: number;
}

interface CachedStreamEntry {
  videoId: string;
  duration?: number;
  cachedAt: number;
}

interface ApiTrackPayload {
  id: string;
  videoId?: string;
  title: string;
  rawTitle?: string;
  channelName?: string;
  artist: string;
  album?: string;
  duration: number;
  coverUrl: string;
  audioUrl?: string;
  fallbackAudioUrls?: string[];
  sourceType: 'online' | 'preview';
  isPreview?: boolean;
}

interface CuratedResponse {
  indonesia?: ApiTrackPayload[];
  global?: ApiTrackPayload[];
  viral?: ApiTrackPayload[];
  indieRnb?: ApiTrackPayload[];
}

interface ItunesSearchResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

interface SaavnSongItem {
  id?: string;
  name?: string;
  title?: string;
  duration?: number | string;
  album?: { name?: string } | string;
  primaryArtists?: string;
  artists?: { primary?: Array<{ name?: string }> };
  image?: Array<{ quality?: string; url?: string; link?: string }>;
  downloadUrl?: Array<{ quality?: string; url?: string; link?: string }>;
}

export interface ResolvedFullStream {
  videoId?: string;
  audioUrl?: string;
  duration?: number;
  isPreviewFallback: boolean;
}

const resolvedVideoIdCache = new Map<string, { videoId: string; duration?: number }>();
const resolvedMusicVideoIdCache = new Map<string, string>();

function readStreamCache(): Record<string, CachedStreamEntry> {
  try {
    const raw = localStorage.getItem(STREAM_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const fresh: Record<string, CachedStreamEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const entry = v as CachedStreamEntry;
      if (entry?.videoId && typeof entry.cachedAt === 'number' && now - entry.cachedAt < CACHE_TTL_24H_MS) {
        fresh[k] = entry;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function getCachedStream(cacheKey: string): { videoId: string; duration?: number } | null {
  const mem = resolvedVideoIdCache.get(cacheKey);
  if (mem?.videoId) return mem;
  const disk = readStreamCache();
  const hit = disk[cacheKey];
  if (hit?.videoId) {
    const val = { videoId: hit.videoId, duration: hit.duration };
    resolvedVideoIdCache.set(cacheKey, val);
    return val;
  }
  return null;
}

function saveCachedStream(cacheKey: string, videoId: string, duration?: number): void {
  resolvedVideoIdCache.set(cacheKey, { videoId, duration });
  try {
    const disk = readStreamCache();
    disk[cacheKey] = { videoId, duration, cachedAt: Date.now() };
    const keys = Object.keys(disk);
    if (keys.length > 80) {
      keys
        .sort((a, b) => disk[a].cachedAt - disk[b].cachedAt)
        .slice(0, keys.length - 80)
        .forEach((oldKey) => delete disk[oldKey]);
    }
    localStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(disk));
  } catch {
    // Ignore storage quota errors
  }
}

function readSearchCache(queryKey: string): Track[] | null {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CachedSearchEntry>;
    const hit = parsed?.[queryKey];
    if (hit && Array.isArray(hit.tracks) && hit.tracks.length > 0 && Date.now() - hit.cachedAt < CACHE_TTL_24H_MS) {
      return hit.tracks;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeSearchCache(queryKey: string, tracks: Track[]): void {
  if (tracks.length === 0) return;
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, CachedSearchEntry>) : {};
    const now = Date.now();
    const cleaned: Record<string, CachedSearchEntry> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      if (v && typeof v.cachedAt === 'number' && now - v.cachedAt < CACHE_TTL_24H_MS) {
        cleaned[k] = v;
      }
    }
    cleaned[queryKey] = { tracks: tracks.slice(0, 30), cachedAt: now };
    const keys = Object.keys(cleaned);
    if (keys.length > 25) {
      keys
        .sort((a, b) => cleaned[a].cachedAt - cleaned[b].cachedAt)
        .slice(0, keys.length - 25)
        .forEach((oldKey) => delete cleaned[oldKey]);
    }
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore storage quota errors
  }
}

function readCuratedCache(): CachedCuratedEntry | null {
  try {
    const raw = localStorage.getItem(CURATED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCuratedEntry;
    if (
      parsed &&
      typeof parsed.cachedAt === 'number' &&
      Date.now() - parsed.cachedAt < CACHE_TTL_24H_MS &&
      Array.isArray(parsed.indonesia) &&
      parsed.indonesia.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Ignore read error
  }
  return null;
}

function writeCuratedCache(data: Omit<CachedCuratedEntry, 'cachedAt'>): void {
  if (data.indonesia.length === 0 && data.global.length === 0) return;
  try {
    const payload: CachedCuratedEntry = { ...data, cachedAt: Date.now() };
    localStorage.setItem(CURATED_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota errors
  }
}

const PIPED_MIRRORS = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
];

const INVIDIOUS_MIRRORS = [
  'https://inv.nadeko.net',
  'https://vid.puffyan.us',
];

export function isPreviewAudioUrl(url?: string): boolean {
  if (!url) return false;
  return /audio-ssl\.itunes\.apple\.com|mzstatic\.com|cdns-preview|cdnt-preview|dzcdn\.net\/stream/i.test(
    url
  );
}

export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchText(input: string): string {
  return normalizeSearchText(input).replace(/\s+/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 4) return Math.abs(m - n);

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

function bigramSimilarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const getBigrams = (str: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };
  const mapA = getBigrams(a);
  const mapB = getBigrams(b);
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;
  for (const v of mapA.values()) totalA += v;
  for (const v of mapB.values()) totalB += v;
  for (const [bg, countA] of mapA.entries()) {
    const countB = mapB.get(bg) || 0;
    intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (totalA + totalB || 1);
}

function scoreClientTrackRelevance(track: Track, query: string, orderIdx: number): number {
  const q = normalizeSearchText(query);
  if (!q) return -orderIdx * 0.1;

  const t = normalizeSearchText(track.title);
  const a = normalizeSearchText(track.artist);
  const qCompact = compactSearchText(query);
  const tCompact = compactSearchText(track.title);
  const aCompact = compactSearchText(track.artist);
  const combinedCompact = `${tCompact}${aCompact}`;

  let score = -orderIdx * 0.12;

  if (a === q) score += 26;
  else if (a.startsWith(q) || a.includes(q)) score += 15;

  if (t === q) score += 28;
  else if (t.startsWith(q)) score += 18;
  else if (t.includes(q)) score += 12;

  if (qCompact.length >= 4) {
    if (tCompact === qCompact) score += 32;
    else if (tCompact.includes(qCompact)) score += 24;
    else if (aCompact === qCompact) score += 24;
    else if (combinedCompact.includes(qCompact)) score += 18;
    else {
      const bestSim = Math.max(
        bigramSimilarity(qCompact, tCompact),
        bigramSimilarity(qCompact, combinedCompact)
      );
      if (bestSim >= 0.55) {
        score += bestSim * 22;
      }
    }
  }

  const qTokens = q.split(' ').filter((tok) => tok.length >= 2);
  const targetTokens = `${t} ${a}`.split(' ').filter((tok) => tok.length >= 2);
  for (const qt of qTokens) {
    if (a.includes(qt) || t.includes(qt)) {
      score += 4.5;
      continue;
    }
    const maxDist = qt.length >= 7 ? 2 : qt.length >= 4 ? 1 : 0;
    if (maxDist > 0 && targetTokens.some((tt) => levenshteinDistance(qt, tt) <= maxDist)) {
      score += 3.2;
    }
  }

  if (track.videoId) score += 2.5;
  if (track.duration >= 90) score += 1;

  const combinedRaw = `${track.title} ${track.artist}`.toLowerCase();
  if (
    !/(karaoke|masala|biography|tribute|ringtone|parody|rimek|mashup|sped\s*up|slowed|reverb|cover)/.test(q) &&
    /\b(karaoke|masala|biography|song\s+for|not\s+a\s+.*song|tribute|ringtone|dj\s+viral\s+rimek)\b/i.test(
      combinedRaw
    )
  ) {
    score -= 30;
  }

  return score;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = MAX_API_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<T> {
  const effectiveTimeout = Math.min(timeoutMs, MAX_API_TIMEOUT_MS);
  const controller = new AbortController();
  let timedOut = false;
  const startedAt = Date.now();
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, effectiveTimeout);

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
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
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

function mapApiTrack(item: ApiTrackPayload, idx: number): Track {
  const rawCover =
    item.coverUrl ||
    (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : DEFAULT_COVER_URL);
  return {
    id: item.id || `track-${idx}-${Date.now()}`,
    videoId: item.videoId,
    title: item.title,
    rawTitle: item.rawTitle,
    channelName: item.channelName,
    artist: item.artist || 'Artis',
    album: item.album || 'Streaming',
    duration: Number.isFinite(item.duration) && item.duration > 0 ? item.duration : 210,
    coverUrl: resizeCoverUrlForMode(rawCover, getCurrentNetworkMode(), 'md'),
    audioUrl: item.audioUrl,
    fallbackAudioUrls: item.fallbackAudioUrls,
    sourceType: 'online',
    isPreview: false,
    lyrics: [],
    lyricsStatus: 'idle',
    createdAt: Date.now(),
  };
}

function normalizeClientKey(title: string, artist: string): string {
  const t = title
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const a = artist
    .toLowerCase()
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${t}::${a}`;
}

function parseClientYtTitle(rawTitle: string, uploaderName?: string): { title: string; artist: string } {
  const cleaned = rawTitle
    .replace(
      /\s*[\(\[]\s*(Official\s*(Music\s*)?Video|Official\s*Lyric\s*Video|Official\s*Audio|Lyric\s*Video|Lyrics?|Lirik|Audio|Visualizer|HD|HQ|4K|MV)\s*[\)\]]/gi,
      ''
    )
    .replace(/\s*\|\s*(Official|Lyrics?|Lirik|Audio).*$/gi, '')
    .trim();

  const fallbackArtist = (uploaderName || 'Artis')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*Official$/i, '')
    .trim();

  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0 && dashIdx < cleaned.length - 3) {
    const left = cleaned.slice(0, dashIdx).trim();
    const right = cleaned.slice(dashIdx + 3).trim();
    if (left.length <= 48 && right.length >= 2) {
      return { artist: left, title: right };
    }
  }
  return { artist: fallbackArtist || 'Artis', title: cleaned || rawTitle };
}

async function searchPipedClient(
  query: string,
  externalSignal?: AbortSignal,
  limit = 16
): Promise<Track[]> {
  for (const mirror of PIPED_MIRRORS) {
    try {
      const json = await fetchJsonWithTimeout<{
        items?: Array<{
          url?: string;
          title?: string;
          uploaderName?: string;
          thumbnail?: string;
          duration?: number;
        }>;
      }>(
        `${mirror}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        4500,
        externalSignal
      );
      const items = Array.isArray(json?.items) ? json.items : [];
      const tracks: Track[] = [];
      for (const item of items) {
        const match =
          item.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
          item.url?.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        const videoId = match?.[1];
        if (!videoId || !item.title) continue;
        const dur = item.duration && item.duration > 40 ? Math.round(item.duration) : 210;
        const { title, artist } = parseClientYtTitle(item.title, item.uploaderName);
        tracks.push({
          id: `yt-${videoId}`,
          videoId,
          title,
          rawTitle: item.title,
          channelName: item.uploaderName,
          artist,
          album: 'YouTube Music',
          duration: dur,
          coverUrl: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          sourceType: 'online',
          isPreview: false,
          lyrics: [],
          lyricsStatus: 'idle',
          createdAt: Date.now(),
        });
        if (tracks.length >= limit) break;
      }
      if (tracks.length > 0) return tracks;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
        throw err;
      }
    }
  }

  for (const mirror of INVIDIOUS_MIRRORS) {
    try {
      const items = await fetchJsonWithTimeout<
        Array<{
          videoId?: string;
          title?: string;
          author?: string;
          lengthSeconds?: number;
        }>
      >(
        `${mirror}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        4500,
        externalSignal
      );
      if (!Array.isArray(items) || items.length === 0) continue;
      const tracks: Track[] = [];
      for (const item of items) {
        if (!item.videoId || !item.title) continue;
        if (item.lengthSeconds && (item.lengthSeconds < 45 || item.lengthSeconds > 720)) continue;
        const { title, artist } = parseClientYtTitle(item.title, item.author);
        tracks.push({
          id: `yt-${item.videoId}`,
          videoId: item.videoId,
          title,
          rawTitle: item.title,
          channelName: item.author,
          artist,
          album: 'YouTube Music',
          duration: item.lengthSeconds && item.lengthSeconds > 40 ? Math.round(item.lengthSeconds) : 210,
          coverUrl: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
          sourceType: 'online',
          isPreview: false,
          lyrics: [],
          lyricsStatus: 'idle',
          createdAt: Date.now(),
        });
        if (tracks.length >= limit) break;
      }
      if (tracks.length > 0) return tracks;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
        throw err;
      }
    }
  }

  return [];
}

async function clientDirectParallelSearch(
  query: string,
  externalSignal?: AbortSignal
): Promise<Track[]> {
  const itunesPromise = fetchJsonWithTimeout<{ results?: ItunesSearchResult[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=ID&lang=id_id&media=music&entity=song&limit=25`,
    5500,
    externalSignal
  )
    .then((d) =>
      (d.results || [])
        .filter((r) => Boolean(r.trackName && r.artistName))
        .map(
          (r): Track => ({
            id: `itunes-${r.trackId ?? Math.random().toString(36).slice(2, 9)}`,
            title: r.trackName || 'Lagu',
            artist: r.artistName || 'Artis',
            album: r.collectionName || 'Single',
            duration:
              r.trackTimeMillis && r.trackTimeMillis > 0
                ? Math.round(r.trackTimeMillis / 1000)
                : 210,
            coverUrl: r.artworkUrl100
              ? r.artworkUrl100.replace('100x100bb', '600x600bb')
              : DEFAULT_COVER_URL,
            audioUrl: r.previewUrl,
            sourceType: 'online',
            isPreview: false,
            lyrics: [],
            lyricsStatus: 'idle',
            createdAt: Date.now(),
          })
        )
    )
    .catch(() => [] as Track[]);

  const saavnPromise = (async () => {
    for (const base of ['https://saavn.dev/api/search/songs', 'https://saavn.sumit.co/api/search/songs']) {
      try {
        const d = await fetchJsonWithTimeout<{ data?: { results?: SaavnSongItem[] } }>(
          `${base}?query=${encodeURIComponent(query)}&limit=20`,
          4500,
          externalSignal
        );
        const rows = d?.data?.results || [];
        if (rows.length > 0) {
          return rows.map((s): Track => {
            const imgs = s.image || [];
            const dls = s.downloadUrl || [];
            const dur = typeof s.duration === 'number' ? s.duration : parseInt(String(s.duration || 210), 10);
            return {
              id: `saavn-${s.id || Math.random().toString(36).slice(2, 9)}`,
              title: s.name || s.title || 'Lagu',
              artist:
                s.artists?.primary?.map((a) => a.name).filter(Boolean).join(', ') ||
                s.primaryArtists ||
                'Artis',
              album: typeof s.album === 'string' ? s.album : s.album?.name || 'Single',
              duration: Number.isFinite(dur) && dur > 0 ? dur : 210,
              coverUrl: imgs[imgs.length - 1]?.url || imgs[imgs.length - 1]?.link || DEFAULT_COVER_URL,
              audioUrl: dls[dls.length - 1]?.url || dls[dls.length - 1]?.link,
              sourceType: 'online',
              isPreview: false,
              lyrics: [],
              lyricsStatus: 'idle',
              createdAt: Date.now(),
            };
          });
        }
      } catch {
        // Try next mirror
      }
    }
    return [] as Track[];
  })();

  const tokenCount = query.trim().split(/\s+/).filter(Boolean).length;
  const ytSongQuery =
    /\b(audio|lyrics?|lirik|song|lagu|official|mv|video)\b/i.test(query) || tokenCount >= 2
      ? query
      : `${query} lagu official`;
  const pipedPromise = searchPipedClient(ytSongQuery, externalSignal, 18).catch(() => [] as Track[]);

  const [itunesTracks, pipedTracks, saavnTracks] = await Promise.all([
    itunesPromise,
    pipedPromise,
    saavnPromise,
  ]);

  const merged: Track[] = [];
  const byKey = new Map<string, number>();
  const maxLen = Math.max(itunesTracks.length, pipedTracks.length, saavnTracks.length);

  for (let i = 0; i < maxLen && merged.length < 50; i++) {
    for (const list of [itunesTracks, pipedTracks, saavnTracks]) {
      const t = list[i];
      if (!t) continue;
      const key = normalizeClientKey(t.title, t.artist);
      const existingIdx = byKey.get(key);
      if (existingIdx !== undefined) {
        const existing = merged[existingIdx];
        if (!existing.videoId && t.videoId) existing.videoId = t.videoId;
        if (!existing.rawTitle && t.rawTitle) existing.rawTitle = t.rawTitle;
        if (!existing.channelName && t.channelName) existing.channelName = t.channelName;
        if (!existing.audioUrl && t.audioUrl) existing.audioUrl = t.audioUrl;
        if (existing.coverUrl === DEFAULT_COVER_URL && t.coverUrl !== DEFAULT_COVER_URL) {
          existing.coverUrl = t.coverUrl;
        }
        continue;
      }
      byKey.set(key, merged.length);
      merged.push(t);
    }
  }

  return merged
    .map((track, idx) => ({ track, score: scoreClientTrackRelevance(track, query, idx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((entry) => entry.track);
}

export async function searchYouTubeTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 16,
  mode: 'audio' | 'mv' = 'audio'
): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const endpoint = `/api/yt-search?q=${encodeURIComponent(trimmed)}&limit=${limit}${
      mode === 'mv' ? '&mode=mv' : ''
    }`;
    const data = await fetchJsonWithTimeout<{ tracks?: ApiTrackPayload[] }>(
      endpoint,
      7500,
      externalSignal
    );

    const items = Array.isArray(data?.tracks) ? data.tracks : [];
    const mapped = items.filter((item) => Boolean(item.videoId && item.title)).map(mapApiTrack);
    if (mapped.length > 0) return mapped;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
  }

  return searchPipedClient(trimmed, externalSignal, limit).catch(() => []);
}

/**
 * Resolves the full-length stream (preferring YouTube full song audio > lyrics fallback > non-preview audio,
 * and keeping 30s previewUrl strictly as last-resort fallback).
 */
export async function resolveFullStream(
  track: Track,
  externalSignal?: AbortSignal
): Promise<ResolvedFullStream> {
  if (track.sourceType === 'local') {
    return {
      audioUrl: track.audioUrl,
      duration: track.duration,
      isPreviewFallback: false,
    };
  }

  if (track.videoId) {
    return {
      videoId: track.videoId,
      duration: track.duration > 45 ? track.duration : undefined,
      isPreviewFallback: false,
    };
  }

  const cleanTitle = track.title.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanArtist = track.artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  const cacheKey = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`;

  const cached = getCachedStream(cacheKey);
  if (cached?.videoId) {
    return {
      videoId: cached.videoId,
      duration: cached.duration,
      isPreviewFallback: false,
    };
  }

  const pickFullCandidate = (candidates: Track[]) =>
    candidates.find((c) => c.videoId && c.duration >= 45) ||
    candidates.find((c) => Boolean(c.videoId)) ||
    null;

  try {
    const officialQuery = `${cleanTitle} ${cleanArtist} official audio`;
    const primaryCandidates = await searchYouTubeTracks(officialQuery, externalSignal, 8);
    let best = pickFullCandidate(primaryCandidates);

    if (!best) {
      const lyricsQuery = `${cleanTitle} ${cleanArtist} lyrics`;
      const fallbackCandidates = await searchYouTubeTracks(lyricsQuery, externalSignal, 8);
      best = pickFullCandidate(fallbackCandidates);
    }

    if (best?.videoId) {
      const fullDuration = best.duration >= 45 ? best.duration : undefined;
      saveCachedStream(cacheKey, best.videoId, fullDuration);
      return {
        videoId: best.videoId,
        duration: fullDuration,
        isPreviewFallback: false,
      };
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
  }

  const fallbackAudio = track.audioUrl || track.fallbackAudioUrls?.[0];
  if (fallbackAudio && !isPreviewAudioUrl(fallbackAudio) && track.duration >= 45) {
    return {
      audioUrl: fallbackAudio,
      duration: track.duration,
      isPreviewFallback: false,
    };
  }

  return {
    audioUrl: fallbackAudio,
    duration: fallbackAudio ? 30 : track.duration,
    isPreviewFallback: Boolean(fallbackAudio),
  };
}

/**
 * Resolves the best embeddable YouTube videoId in the background for any iTunes/Deezer/JioSaavn track.
 */
export async function resolveYouTubeVideoId(
  artist: string,
  title: string,
  externalSignal?: AbortSignal
): Promise<string | null> {
  const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanArtist = artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  const cacheKey = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`;

  const cached = getCachedStream(cacheKey);
  if (cached?.videoId) return cached.videoId;

  try {
    const query = `${cleanTitle} ${cleanArtist} official audio`;
    const candidates = await searchYouTubeTracks(query, externalSignal, 6);
    let best = candidates.find((c) => c.videoId && c.duration >= 45) || candidates[0];

    if (!best?.videoId) {
      const lyricCandidates = await searchYouTubeTracks(
        `${cleanTitle} ${cleanArtist} lyrics`,
        externalSignal,
        6
      );
      best = lyricCandidates.find((c) => c.videoId && c.duration >= 45) || lyricCandidates[0];
    }

    if (best?.videoId) {
      saveCachedStream(
        cacheKey,
        best.videoId,
        best.duration >= 45 ? best.duration : undefined
      );
      return best.videoId;
    }
    return null;
  } catch {
    return null;
  }
}

const OFFICIAL_CHANNEL_REGEX =
  /(vevo|official|records|music|entertainment|musica|aquarius|nagaswara|trinity|sony|warner|universal|88rising|label|studio|proaktif|blackboard|ascada|pelangi|falcon|\s-\s*topic$)/i;

const AMATEUR_MV_KEYWORDS_REGEX =
  /\b(karaoke|smule|starmaker|guitar\s*cover|piano\s*cover|drum\s*cover|bass\s*cover|violin\s*cover|vocal\s*cover|acoustic\s*cover|slowed|reverb|nightcore|8d\s*audio|sped\s*up|fan\s*made|fanmade|parody|reaction|tutorial|chord|ringtone)\b/i;

function isOfficialChannelUpload(channelName?: string, artistHint?: string): boolean {
  if (!channelName) return false;
  if (OFFICIAL_CHANNEL_REGEX.test(channelName)) return true;
  if (artistHint) {
    const normChannel = normalizeSearchText(channelName);
    const normArtist = normalizeSearchText(artistHint);
    if (normArtist.length >= 3 && normChannel.includes(normArtist)) return true;
  }
  return false;
}

function isValidOfficialMusicVideoCandidate(candidate: Track, artistHint?: string): boolean {
  if (!candidate.videoId) return false;
  const rawTitle = candidate.rawTitle || candidate.title || '';
  const channel = candidate.channelName || '';
  if (AMATEUR_MV_KEYWORDS_REGEX.test(rawTitle)) return false;

  const isOfficialChannel = isOfficialChannelUpload(channel, artistHint);
  if (/\bcover\b/i.test(rawTitle) && !/\bofficial\b/i.test(rawTitle) && !isOfficialChannel) {
    return false;
  }

  return true;
}

function scoreMusicVideoCandidate(candidate: Track, artistHint?: string): number {
  const t = (candidate.rawTitle || candidate.title || '').toLowerCase();
  const c = (candidate.channelName || '').toLowerCase();
  const isOfficialChannel = isOfficialChannelUpload(candidate.channelName, artistHint);

  let score = 0;
  if (t.includes('official music video')) score += 20;
  if (t.includes('official mv')) score += 18;
  if (t.includes('official video')) score += 16;
  if (t.includes('music video') || /\bmv\b/.test(t)) score += 12;
  if (t.includes('official audio')) score += 7;
  if (t.includes('visualizer')) score += 3;
  if (t.includes('lyric video') || /\b(lyrics?|lirik)\b/.test(t)) {
    score += isOfficialChannel ? 1 : -6;
  }
  if (t.includes('audio only') || t.includes('static')) score -= 6;
  if (isOfficialChannel) score += 8;
  if (c.endsWith('- topic')) score -= 5;
  return score;
}

function pickBestOfficialMusicVideo(candidates: Track[], artistHint?: string): Track | null {
  const filtered = candidates.filter((c) => isValidOfficialMusicVideoCandidate(c, artistHint));
  if (filtered.length === 0) return null;

  return (
    [...filtered].sort(
      (a, b) => scoreMusicVideoCandidate(b, artistHint) - scoreMusicVideoCandidate(a, artistHint)
    )[0] || null
  );
}

/**
 * Resolves a real Official Music Video / Official Video / Official Audio or official artist/label upload videoId
 * for Focus Zone & Ambient Video Backdrop, filtering out amateur karaoke and unofficial covers.
 */
export async function resolveYouTubeMusicVideoId(
  artist: string,
  title: string,
  externalSignal?: AbortSignal
): Promise<string | null> {
  const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanArtist = artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  const cacheKey = `mv::${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`;

  const cached = resolvedMusicVideoIdCache.get(cacheKey);
  if (cached) return cached;

  try {
    const primaryQuery = `${cleanTitle} ${cleanArtist} Official Music Video`;
    const primaryCandidates = await searchYouTubeTracks(primaryQuery, externalSignal, 10, 'mv');
    let best = pickBestOfficialMusicVideo(primaryCandidates, cleanArtist);

    if (!best) {
      const secondaryQuery = `${cleanTitle} ${cleanArtist} Official Video`;
      const secondaryCandidates = await searchYouTubeTracks(secondaryQuery, externalSignal, 10, 'mv');
      best = pickBestOfficialMusicVideo(secondaryCandidates, cleanArtist);
    }

    if (!best) {
      const tertiaryQuery = `${cleanTitle} ${cleanArtist} Official Audio`;
      const tertiaryCandidates = await searchYouTubeTracks(tertiaryQuery, externalSignal, 8, 'mv');
      best = pickBestOfficialMusicVideo(tertiaryCandidates, cleanArtist);
    }

    const mvId = best?.videoId || null;
    if (mvId) {
      resolvedMusicVideoIdCache.set(cacheKey, mvId);
    }
    return mvId;
  } catch {
    return null;
  }
}

/**
 * Primary Smart Global + Indonesian + YouTube Catalog Search (fuzzy & typo-tolerant).
 */
export async function searchOnlineTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 40
): Promise<{ tracks: Track[]; source: 'catalog' | 'client-fallback' | 'cache' }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { tracks: [], source: 'catalog' };
  }

  const cacheKey = normalizeSearchText(trimmed);
  const cachedHit = cacheKey ? readSearchCache(cacheKey) : null;
  if (cachedHit && cachedHit.length > 0) {
    return { tracks: cachedHit.slice(0, limit), source: 'cache' };
  }

  try {
    const data = await fetchJsonWithTimeout<{ tracks?: ApiTrackPayload[] }>(
      `/api/music-search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
      MAX_API_TIMEOUT_MS,
      externalSignal
    );
    const items = Array.isArray(data?.tracks) ? data.tracks : [];
    if (items.length > 0) {
      const mapped = items.map(mapApiTrack).slice(0, limit);
      if (cacheKey) writeSearchCache(cacheKey, mapped);
      return {
        tracks: mapped,
        source: 'catalog',
      };
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
  }

  const fallback = await clientDirectParallelSearch(trimmed, externalSignal);
  if (cacheKey && fallback.length > 0) {
    writeSearchCache(cacheKey, fallback);
  }
  return { tracks: fallback, source: 'client-fallback' };
}

export async function searchTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 40
): Promise<Track[]> {
  const { tracks } = await searchOnlineTracks(query, externalSignal, limit);
  return tracks;
}

interface ItunesRssEntry {
  id?: { attributes?: { 'im:id'?: string } };
  'im:name'?: { label?: string };
  'im:artist'?: { label?: string };
  'im:collection'?: { 'im:name'?: { label?: string } };
  'im:image'?: Array<{ label?: string }>;
  link?: Array<{ attributes?: { href?: string; type?: string } }> | { attributes?: { href?: string } };
}

async function fetchItunesTopChartClient(
  country: 'id' | 'us' | 'gb',
  limit = 20,
  externalSignal?: AbortSignal
): Promise<Track[]> {
  try {
    const json = await fetchJsonWithTimeout<{ feed?: { entry?: ItunesRssEntry[] } }>(
      `https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`,
      6000,
      externalSignal
    );
    const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];
    return entries
      .map((entry, idx): Track | null => {
        const title = entry['im:name']?.label?.trim();
        const artist = entry['im:artist']?.label?.trim();
        if (!title || !artist) return null;

        const imgs = entry['im:image'] || [];
        const rawImg = imgs[imgs.length - 1]?.label || '';
        const coverUrl = rawImg ? rawImg.replace(/\d+x\d+bb/, '600x600bb') : DEFAULT_COVER_URL;

        let previewUrl: string | undefined;
        if (Array.isArray(entry.link)) {
          const audioLink = entry.link.find((l) => l.attributes?.type?.includes('audio'));
          previewUrl = audioLink?.attributes?.href;
        }

        const chartId = entry.id?.attributes?.['im:id'] || `${country}-${idx}`;
        return {
          id: `chart-${country}-${chartId}`,
          title,
          artist,
          album: entry['im:collection']?.['im:name']?.label?.trim() || 'Top Charts',
          duration: 210,
          coverUrl,
          audioUrl: previewUrl,
          sourceType: 'online',
          isPreview: false,
          lyrics: [],
          lyricsStatus: 'idle',
          createdAt: Date.now(),
        };
      })
      .filter((t): t is Track => t !== null);
  } catch {
    return [];
  }
}

export async function fetchCuratedFeeds(externalSignal?: AbortSignal): Promise<{
  indonesia: Track[];
  global: Track[];
  viral: Track[];
  indieRnb: Track[];
}> {
  const cached = readCuratedCache();
  if (cached && getCurrentNetworkMode() === 'lite') {
    return {
      indonesia: cached.indonesia,
      global: cached.global,
      viral: cached.viral,
      indieRnb: cached.indieRnb,
    };
  }

  let indonesia: Track[] = [];
  let global: Track[] = [];
  let viral: Track[] = [];
  let indieRnb: Track[] = [];

  try {
    const data = await fetchJsonWithTimeout<CuratedResponse>(
      '/api/curated',
      MAX_API_TIMEOUT_MS,
      externalSignal
    );
    indonesia = (data.indonesia || []).map(mapApiTrack);
    global = (data.global || []).map(mapApiTrack);
    viral = (data.viral || []).map(mapApiTrack);
    indieRnb = (data.indieRnb || []).map(mapApiTrack);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
  }

  if (indonesia.length === 0 || global.length === 0) {
    const [idDirect, usDirect, gbDirect] = await Promise.all([
      indonesia.length === 0 ? fetchItunesTopChartClient('id', 20, externalSignal) : Promise.resolve(indonesia),
      global.length === 0 ? fetchItunesTopChartClient('us', 20, externalSignal) : Promise.resolve(global),
      viral.length === 0 ? fetchItunesTopChartClient('gb', 20, externalSignal) : Promise.resolve(viral),
    ]);
    indonesia = idDirect;
    global = usDirect;
    viral = gbDirect;
  }

  if (indonesia.length === 0 && global.length === 0 && cached) {
    return {
      indonesia: cached.indonesia,
      global: cached.global,
      viral: cached.viral,
      indieRnb: cached.indieRnb,
    };
  }

  writeCuratedCache({ indonesia, global, viral, indieRnb });
  return { indonesia, global, viral, indieRnb };
}
