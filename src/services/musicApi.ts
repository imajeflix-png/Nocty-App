import { Track } from '../types/music';
import { DEFAULT_COVER_URL } from '../data/moods';
import {
  detectTrackMood,
  extractPrimaryArtistName,
  getPrimaryArtistKey,
  getSimilarArtistsForTrack,
  getTypoQueryVariant,
  normalizeTitleKey,
  normalizeTypoSearchText,
} from '../utils/audioUtils';
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
  description?: string;
  isVerifiedChannel?: boolean;
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
const resolvedMusicVideoCandidatesCache = new Map<string, Track[]>();

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

const CLIENT_POPULAR_ARTIST_SET = new Set([
  'hindia',
  '.feast',
  'feast',
  'tulus',
  'bernadya',
  'nadin amizah',
  'sal priadi',
  'pamungkas',
  'feby putri',
  'mahalini',
  'lyodra',
  'tiara andini',
  'rizky febian',
  'juicy luicy',
  'sheila on 7',
  'dewa 19',
  'dewa',
  'noah',
  'peterpan',
  'padi',
  'ungu',
  'nidji',
  'niki',
  'rich brian',
  'ardhito pramono',
  'nadhif basalamah',
  'raisa',
  'afgan',
  'yura yunita',
  'kunto aji',
  'reality club',
  'fourtwnty',
  'payung teduh',
  'danilla',
  'efek rumah kaca',
  'barasuara',
  'perunggu',
  'denny caknan',
  'the weeknd',
  'bruno mars',
  'taylor swift',
  'billie eilish',
  'ariana grande',
  'dua lipa',
  'coldplay',
  'sza',
  'joji',
  'daniel caesar',
  'frank ocean',
  'keshi',
  'laufey',
  'lany',
  'sabrina carpenter',
  'harry styles',
  'arctic monkeys',
  'radiohead',
  'olivia rodrigo',
  'bts',
  'blackpink',
  'newjeans',
  'bigbang',
  'seventeen',
  'twice',
  'aespa',
  'ive',
  'jungkook',
  'iu',
]);

function scoreClientTrackRelevance(
  track: Track,
  query: string,
  orderIdx: number,
  sourceHits = 1
): number {
  const q = normalizeSearchText(query);
  if (!q) return -orderIdx * 0.1;

  const t = normalizeSearchText(track.title);
  const a = normalizeSearchText(track.artist);
  const qSqueezed = normalizeTypoSearchText(query);
  const tSqueezed = normalizeTypoSearchText(track.title);
  const aSqueezed = normalizeTypoSearchText(track.artist);

  const qCompact = compactSearchText(query);
  const tCompact = compactSearchText(track.title);
  const aCompact = compactSearchText(track.artist);
  const qSqueezedCompact = qSqueezed.replace(/\s+/g, '');
  const tSqueezedCompact = tSqueezed.replace(/\s+/g, '');
  const aSqueezedCompact = aSqueezed.replace(/\s+/g, '');
  const combinedCompact = `${tCompact}${aCompact}`;

  let score = Math.max(0, 12 - orderIdx * 0.75);

  if (sourceHits > 1) {
    score += Math.min(30, (sourceHits - 1) * 11);
  }

  if (a === q || (qSqueezed && aSqueezed === qSqueezed)) score += 28;
  else if (a.startsWith(q) || a.includes(q) || (qSqueezed && aSqueezed.includes(qSqueezed))) score += 16;

  if (t === q || (qSqueezed && tSqueezed === qSqueezed)) score += 34;
  else if (t.startsWith(q) || (qSqueezed && tSqueezed.startsWith(qSqueezed))) score += 22;
  else if (t.includes(q) || (qSqueezed && tSqueezed.includes(qSqueezed))) score += 14;

  if (qSqueezedCompact.length >= 4) {
    if (tCompact === qCompact || tSqueezedCompact === qSqueezedCompact) score += 30;
    else if (tCompact.includes(qCompact) || tSqueezedCompact.includes(qSqueezedCompact)) score += 22;
    else if (aCompact === qCompact || aSqueezedCompact === qSqueezedCompact) score += 22;
    else if (combinedCompact.includes(qCompact)) score += 16;
    else {
      const bestSim = Math.max(
        bigramSimilarity(qSqueezedCompact, tSqueezedCompact),
        bigramSimilarity(qSqueezedCompact, `${tSqueezedCompact}${aSqueezedCompact}`)
      );
      if (bestSim >= 0.55) {
        score += bestSim * 22;
      }
    }
  }

  const qTokens = qSqueezed.split(' ').filter((tok) => tok.length >= 2);
  const targetTokens = `${tSqueezed} ${aSqueezed}`.split(' ').filter((tok) => tok.length >= 2);
  for (const qt of qTokens) {
    if (aSqueezed.includes(qt) || tSqueezed.includes(qt)) {
      score += 5;
      continue;
    }
    const maxDist = qt.length >= 7 ? 2 : qt.length >= 4 ? 1 : 0;
    if (maxDist > 0 && targetTokens.some((tt) => levenshteinDistance(qt, tt) <= maxDist)) {
      score += 3.5;
    }
  }

  const primaryArtistKey = getPrimaryArtistKey(track.artist);
  if (CLIENT_POPULAR_ARTIST_SET.has(primaryArtistKey)) {
    score += 14;
  }
  if (track.isVerifiedChannel || /vevo|official/i.test(track.channelName || '')) {
    score += 7;
  }

  if (track.videoId) score += 2.5;
  if (track.duration >= 90) score += 1;

  const combinedRaw = `${track.title} ${track.artist} ${track.rawTitle || ''}`.toLowerCase();
  if (
    !/(karaoke|masala|biography|tribute|ringtone|parody|rimek|mashup|sped\s*up|slowed|reverb|cover|koplo|dangdut|remix|live|lirik)/.test(
      qSqueezed
    )
  ) {
    if (
      /\b(karaoke|masala|biography|song\s+for|not\s+a\s+.*song|tribute|ringtone|dj\s+viral\s+rimek)\b/i.test(
        combinedRaw
      )
    ) {
      score -= 35;
    } else if (
      /\b(cover|sped\s*up|slowed|reverb|koplo|remix|mashup|live\s+performance|karaoke\s+version)\b/i.test(
        combinedRaw
      )
    ) {
      score -= 18;
    }
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
    description: item.description,
    isVerifiedChannel: item.isVerifiedChannel,
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
  limit = 16,
  mode: 'audio' | 'mv' = 'audio'
): Promise<Track[]> {
  const pipedFilter = mode === 'mv' ? 'videos' : 'music_songs';
  for (const mirror of PIPED_MIRRORS) {
    try {
      const json = await fetchJsonWithTimeout<{
        items?: Array<{
          url?: string;
          title?: string;
          uploaderName?: string;
          uploaderVerified?: boolean;
          shortDescription?: string;
          thumbnail?: string;
          duration?: number;
        }>;
      }>(
        `${mirror}/search?q=${encodeURIComponent(query)}&filter=${pipedFilter}`,
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
          description: item.shortDescription,
          isVerifiedChannel: item.uploaderVerified,
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
          authorVerified?: boolean;
          description?: string;
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
          description: item.description,
          isVerifiedChannel: item.authorVerified,
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
  const hitCounts = new Map<string, number>();
  const maxLen = Math.max(itunesTracks.length, pipedTracks.length, saavnTracks.length);

  for (let i = 0; i < maxLen && merged.length < 50; i++) {
    for (const list of [itunesTracks, pipedTracks, saavnTracks]) {
      const t = list[i];
      if (!t) continue;
      const key = normalizeClientKey(t.title, t.artist);
      hitCounts.set(key, (hitCounts.get(key) || 0) + 1);
      const existingIdx = byKey.get(key);
      if (existingIdx !== undefined) {
        const existing = merged[existingIdx];
        if (!existing.videoId && t.videoId) existing.videoId = t.videoId;
        if (!existing.rawTitle && t.rawTitle) existing.rawTitle = t.rawTitle;
        if (!existing.channelName && t.channelName) existing.channelName = t.channelName;
        if (!existing.isVerifiedChannel && t.isVerifiedChannel) {
          existing.isVerifiedChannel = t.isVerifiedChannel;
        }
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
    .map((track, idx) => {
      const key = normalizeClientKey(track.title, track.artist);
      return {
        track,
        score: scoreClientTrackRelevance(track, query, idx, hitCounts.get(key) || 1),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((entry) => entry.track);
}

export async function searchYouTubeTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 16,
  mode: 'audio' | 'mv' = 'audio',
  expectedDuration = 0
): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const durParam = mode === 'mv' && expectedDuration > 45 ? `&duration=${Math.round(expectedDuration)}` : '';
    const endpoint = `/api/yt-search?q=${encodeURIComponent(trimmed)}&limit=${limit}${
      mode === 'mv' ? '&mode=mv' : ''
    }${durParam}`;
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

  return searchPipedClient(trimmed, externalSignal, limit, mode).catch(() => []);
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
  /(vevo|official|records|music|entertainment|musica|aquarius|nagaswara|trinity|sony|warner|universal|88rising|label|studio|proaktif|blackboard|ascada|pelangi|falcon)/i;

const STRICT_MV_BLOCKED_TITLE_REGEX =
  /\b(audio|static|lyrics?|lirik|karaoke|cover|slowed|sped\s*up|reverb|nightcore|instrumental|8d\s*audio)\b/i;

function isOfficialChannelUpload(
  channelName?: string,
  artistHint?: string,
  isVerifiedChannel?: boolean
): boolean {
  if (isVerifiedChannel) return true;
  if (!channelName || /-\s*topic\b/i.test(channelName)) return false;
  if (OFFICIAL_CHANNEL_REGEX.test(channelName)) return true;
  if (artistHint) {
    const normChannel = normalizeSearchText(channelName);
    const normArtist = normalizeSearchText(artistHint);
    if (normArtist.length >= 3 && normChannel.includes(normArtist)) return true;
  }
  return false;
}

export function isValidOfficialMusicVideoCandidate(
  candidate: Track,
  _artistHint?: string,
  expectedDuration = 0
): boolean {
  if (!candidate.videoId) return false;
  const rawTitle = candidate.rawTitle || candidate.title || '';
  const channel = candidate.channelName || '';
  const description = candidate.description || '';

  // Strict absolute block rules
  if (/-\s*topic\b/i.test(channel)) return false;
  if (/provided\s+to\s+youtube/i.test(description)) return false;
  if (STRICT_MV_BLOCKED_TITLE_REGEX.test(rawTitle)) return false;

  // Duration filter: within ±45s of original track duration (and 45s..720s overall)
  if (candidate.duration > 0) {
    if (candidate.duration < 45 || candidate.duration > 720) return false;
    if (expectedDuration > 45 && Math.abs(candidate.duration - expectedDuration) > 45) {
      return false;
    }
  }

  return true;
}

function scoreMusicVideoCandidate(candidate: Track, artistHint?: string): number {
  const t = (candidate.rawTitle || candidate.title || '').toLowerCase();
  const isOfficialChannel = isOfficialChannelUpload(
    candidate.channelName,
    artistHint,
    candidate.isVerifiedChannel
  );

  let score = 0;

  // Priority 1 (+100 pts): Official Music Video, Official MV, or Music Video
  if (t.includes('official music video') || t.includes('official mv') || t.includes('music video')) {
    score += 100;
  }

  // Priority 2 (+60 pts): Official Video or verified/label/VEVO channel
  if (t.includes('official video') || isOfficialChannel) {
    score += 60;
  }

  if (/\bmv\b/.test(t)) score += 15;
  if (t.includes('live') || t.includes('concert') || t.includes('acoustic')) score -= 25;
  if (t.includes('visualizer')) score -= 10;

  return score;
}

function rankOfficialMusicVideoCandidates(
  candidates: Track[],
  artistHint?: string,
  expectedDuration = 0
): Track[] {
  const seen = new Set<string>();
  const filtered: Track[] = [];
  for (const c of candidates) {
    if (!c.videoId || seen.has(c.videoId)) continue;
    if (!isValidOfficialMusicVideoCandidate(c, artistHint, expectedDuration)) continue;
    seen.add(c.videoId);
    filtered.push(c);
  }

  return filtered.sort(
    (a, b) => scoreMusicVideoCandidate(b, artistHint) - scoreMusicVideoCandidate(a, artistHint)
  );
}

/**
 * Resolves up to 10 strictly filtered, scored Official Music Video candidates
 * using query "[Artist] - [Title] Official Music Video".
 */
export async function resolveYouTubeMusicVideoCandidates(
  artist: string,
  title: string,
  expectedDuration = 0,
  externalSignal?: AbortSignal
): Promise<Track[]> {
  const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanArtist = artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  const durBucket = expectedDuration > 45 ? Math.round(expectedDuration / 10) : 0;
  const cacheKey = `mv::${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}::${durBucket}`;

  const cached = resolvedMusicVideoCandidatesCache.get(cacheKey);
  if (cached && cached.length > 0) return cached;

  try {
    const primaryQuery = `${cleanArtist} - ${cleanTitle} Official Music Video`;
    const primaryCandidates = await searchYouTubeTracks(
      primaryQuery,
      externalSignal,
      10,
      'mv',
      expectedDuration
    );
    let ranked = rankOfficialMusicVideoCandidates(primaryCandidates, cleanArtist, expectedDuration);

    if (ranked.length === 0) {
      const secondaryQuery = `${cleanArtist} - ${cleanTitle} Official Video`;
      const secondaryCandidates = await searchYouTubeTracks(
        secondaryQuery,
        externalSignal,
        10,
        'mv',
        expectedDuration
      );
      ranked = rankOfficialMusicVideoCandidates(secondaryCandidates, cleanArtist, expectedDuration);
    }

    if (ranked.length > 0) {
      resolvedMusicVideoCandidatesCache.set(cacheKey, ranked.slice(0, 10));
    }
    return ranked.slice(0, 10);
  } catch {
    return [];
  }
}

export async function resolveYouTubeMusicVideoId(
  artist: string,
  title: string,
  externalSignal?: AbortSignal,
  expectedDuration = 0
): Promise<string | null> {
  const candidates = await resolveYouTubeMusicVideoCandidates(
    artist,
    title,
    expectedDuration,
    externalSignal
  );
  return candidates[0]?.videoId || null;
}

/**
 * Primary Smart Global + Indonesian + YouTube Catalog Search (fuzzy & typo-tolerant).
 */
export async function searchOnlineTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 40
): Promise<{ tracks: Track[]; source: 'catalog' | 'client-fallback' | 'cache' }> {
  const rawTrimmed = query.trim();
  if (!rawTrimmed) {
    return { tracks: [], source: 'catalog' };
  }

  const cleanedQ = getTypoQueryVariant(rawTrimmed) || rawTrimmed;
  const trimmed = cleanedQ !== rawTrimmed ? cleanedQ : rawTrimmed;

  const cacheKey = normalizeTypoSearchText(trimmed);
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

/**
 * Generates a Spotify-style Smart Radio Queue in the background for a chosen track:
 * - 3-4 other popular tracks by the exact same primary artist
 * - 6-8 tracks from genre & vibe-aligned companion artists
 * - Strictly blocks tracks sharing the exact same title from other artists
 */
export async function generateSmartRadioTracks(
  anchorTrack: Track,
  localPool: Track[] = [],
  externalSignal?: AbortSignal
): Promise<Track[]> {
  const anchorTitleKey = normalizeTitleKey(anchorTrack.title);
  const anchorArtistName = extractPrimaryArtistName(anchorTrack.artist);
  const anchorArtistKey = getPrimaryArtistKey(anchorTrack.artist);
  const anchorMood = detectTrackMood(anchorTrack).mood;
  const similarArtists = getSimilarArtistsForTrack(anchorTrack);
  const similarArtistKeys = similarArtists.map((a) => getPrimaryArtistKey(a));

  const selectedPeers = similarArtists.slice(0, 4);

  const [sameArtistRes, ...peerResults] = await Promise.allSettled([
    anchorArtistName && anchorArtistName.toLowerCase() !== 'artis'
      ? searchOnlineTracks(anchorArtistName, externalSignal, 18)
      : Promise.resolve({ tracks: [] as Track[] }),
    ...selectedPeers.map((peerArtist) => searchOnlineTracks(peerArtist, externalSignal, 10)),
  ]);

  if (externalSignal?.aborted) return [];

  const sameArtistFetched = sameArtistRes.status === 'fulfilled' ? sameArtistRes.value.tracks : [];
  const peerFetched: Track[] = [];
  for (const res of peerResults) {
    if (res.status === 'fulfilled') {
      peerFetched.push(...res.value.tracks);
    }
  }

  const combinedCandidates = [
    ...sameArtistFetched,
    ...peerFetched,
    ...localPool,
  ];

  const isCleanStudioCandidate = (t: Track): boolean => {
    const raw = `${t.title} ${t.rawTitle || ''}`.toLowerCase();
    return !/\b(karaoke|sped\s*up|slowed|reverb|cover|ringtone|tribute|parody|koplo|remix)\b/i.test(
      raw
    );
  };

  const seenTrackKeys = new Set<string>();
  const sameArtistTracks: Track[] = [];
  const peerArtistTracks: Track[] = [];
  const peerArtistCap = new Map<string, number>();

  const tryRegisterKey = (t: Track): boolean => {
    if (!t || !t.id || t.id === anchorTrack.id) return false;
    const tKey = normalizeTitleKey(t.title);
    if (!tKey) return false;
    // STRICT RULE: Never queue any track with the exact same canonical title (even from different artists)
    if (anchorTitleKey && tKey === anchorTitleKey) return false;

    const aKey = getPrimaryArtistKey(t.artist);
    const dedupKey = `${tKey}::${aKey}`;
    if (seenTrackKeys.has(dedupKey) || seenTrackKeys.has(`id::${t.id}`)) return false;
    seenTrackKeys.add(dedupKey);
    seenTrackKeys.add(`id::${t.id}`);
    return true;
  };

  // 1. Collect 3-4 popular tracks from the exact same artist
  const rawSameArtist = combinedCandidates.filter(
    (t) => getPrimaryArtistKey(t.artist) === anchorArtistKey
  );
  // Prefer clean studio tracks first
  rawSameArtist.sort((a, b) => Number(isCleanStudioCandidate(b)) - Number(isCleanStudioCandidate(a)));
  for (const t of rawSameArtist) {
    if (sameArtistTracks.length >= 4) break;
    if (tryRegisterKey(t)) {
      sameArtistTracks.push(t);
    }
  }

  // 2. Collect 6-8 tracks from vibe & genre-aligned companion artists
  const rawPeers = combinedCandidates.filter((t) => {
    const aKey = getPrimaryArtistKey(t.artist);
    return aKey && aKey !== anchorArtistKey;
  });

  rawPeers.sort((a, b) => {
    const aKeyA = getPrimaryArtistKey(a.artist);
    const aKeyB = getPrimaryArtistKey(b.artist);
    const peerMatchA = similarArtistKeys.some((pk) => aKeyA.includes(pk) || pk.includes(aKeyA)) ? 2 : 0;
    const peerMatchB = similarArtistKeys.some((pk) => aKeyB.includes(pk) || pk.includes(aKeyB)) ? 2 : 0;
    const moodMatchA = detectTrackMood(a).mood === anchorMood ? 1 : 0;
    const moodMatchB = detectTrackMood(b).mood === anchorMood ? 1 : 0;
    const cleanA = isCleanStudioCandidate(a) ? 1 : 0;
    const cleanB = isCleanStudioCandidate(b) ? 1 : 0;
    return peerMatchB + moodMatchB + cleanB - (peerMatchA + moodMatchA + cleanA);
  });

  for (const t of rawPeers) {
    if (peerArtistTracks.length >= 8) break;
    const aKey = getPrimaryArtistKey(t.artist);
    const countForArtist = peerArtistCap.get(aKey) || 0;
    if (countForArtist >= 2) continue;
    if (tryRegisterKey(t)) {
      peerArtistCap.set(aKey, countForArtist + 1);
      peerArtistTracks.push(t);
    }
  }

  // 3. Interleave smoothly: 1 same-artist hit, 2 vibe-peer hits, repeat...
  const radioQueue: Track[] = [];
  let si = 0;
  let pi = 0;
  while (si < sameArtistTracks.length || pi < peerArtistTracks.length) {
    if (si < sameArtistTracks.length) {
      radioQueue.push(sameArtistTracks[si++]);
    }
    if (pi < peerArtistTracks.length) {
      radioQueue.push(peerArtistTracks[pi++]);
    }
    if (pi < peerArtistTracks.length) {
      radioQueue.push(peerArtistTracks[pi++]);
    }
  }

  return radioQueue.slice(0, 12);
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
