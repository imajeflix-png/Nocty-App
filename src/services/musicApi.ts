import { Track } from '../types/music';
import { DEFAULT_COVER_URL } from '../data/moods';

interface ApiTrackPayload {
  id: string;
  videoId?: string;
  title: string;
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

const resolvedVideoIdCache = new Map<string, string>();

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000,
  externalSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

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
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

function mapApiTrack(item: ApiTrackPayload, idx: number): Track {
  return {
    id: item.id || `track-${idx}-${Date.now()}`,
    videoId: item.videoId,
    title: item.title,
    artist: item.artist || 'Artis',
    album: item.album || 'Streaming',
    duration: Number.isFinite(item.duration) && item.duration > 0 ? item.duration : 210,
    coverUrl:
      item.coverUrl ||
      (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : DEFAULT_COVER_URL),
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
    .split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${t}::${a}`;
}

async function clientDirectParallelSearch(
  query: string,
  externalSignal?: AbortSignal
): Promise<Track[]> {
  const itunesPromise = fetchJsonWithTimeout<{ results?: ItunesSearchResult[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=30`,
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
          `${base}?query=${encodeURIComponent(query)}&limit=30`,
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

  const [itunesTracks, saavnTracks] = await Promise.all([itunesPromise, saavnPromise]);
  const seen = new Set<string>();
  const combined: Track[] = [];
  const maxLen = Math.max(itunesTracks.length, saavnTracks.length);

  for (let i = 0; i < maxLen && combined.length < 40; i++) {
    for (const list of [itunesTracks, saavnTracks]) {
      const t = list[i];
      if (!t) continue;
      const key = normalizeClientKey(t.title, t.artist);
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(t);
      if (combined.length >= 40) break;
    }
  }
  return combined;
}

export async function searchYouTubeTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 16
): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const endpoint = `/api/yt-search?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
  const data = await fetchJsonWithTimeout<{ tracks?: ApiTrackPayload[] }>(
    endpoint,
    7500,
    externalSignal
  );

  const items = Array.isArray(data?.tracks) ? data.tracks : [];
  return items.filter((item) => Boolean(item.videoId && item.title)).map(mapApiTrack);
}

const resolvedMusicVideoIdCache = new Map<string, string>();

/**
 * Resolves the best embeddable YouTube videoId in the background for any iTunes/JioSaavn track.
 */
export async function resolveYouTubeVideoId(
  artist: string,
  title: string,
  externalSignal?: AbortSignal
): Promise<string | null> {
  const cleanTitle = title.replace(/\s*\([^)]*\)/g, '').trim();
  const cleanArtist = artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  const cacheKey = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`;

  const cached = resolvedVideoIdCache.get(cacheKey);
  if (cached) return cached;

  try {
    const query = `${cleanArtist} ${cleanTitle} official audio`;
    const candidates = await searchYouTubeTracks(query, externalSignal, 6);
    const best = candidates[0]?.videoId || null;
    if (best) {
      resolvedVideoIdCache.set(cacheKey, best);
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Resolves a real moving Official Music Video videoId for Ambient Video Backdrop.
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
    const query = `${cleanArtist} ${cleanTitle} official music video`;
    const candidates = await searchYouTubeTracks(query, externalSignal, 8);
    const preferred =
      candidates.find((c) => {
        const t = c.title.toLowerCase();
        return (
          (t.includes('official music video') ||
            t.includes('official video') ||
            t.includes('music video') ||
            t.includes('mv')) &&
          !t.includes('official audio') &&
          !t.includes('lyrics')
        );
      }) ||
      candidates.find((c) => !c.title.toLowerCase().includes('official audio')) ||
      candidates[0] ||
      null;

    const best = preferred?.videoId || null;
    if (best) {
      resolvedMusicVideoIdCache.set(cacheKey, best);
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Primary Global + Indonesian Catalog Search (up to 40 deduplicated tracks from JioSaavn + iTunes).
 */
export async function searchOnlineTracks(
  query: string,
  externalSignal?: AbortSignal,
  limit = 40
): Promise<{ tracks: Track[]; source: 'catalog' | 'client-fallback' }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { tracks: [], source: 'catalog' };
  }

  try {
    const data = await fetchJsonWithTimeout<{ tracks?: ApiTrackPayload[] }>(
      `/api/music-search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
      9000,
      externalSignal
    );
    const items = Array.isArray(data?.tracks) ? data.tracks : [];
    if (items.length > 0) {
      return {
        tracks: items.map(mapApiTrack).slice(0, limit),
        source: 'catalog',
      };
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
  }

  const fallback = await clientDirectParallelSearch(trimmed, externalSignal);
  return { tracks: fallback, source: 'client-fallback' };
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
  let indonesia: Track[] = [];
  let global: Track[] = [];
  let viral: Track[] = [];
  let indieRnb: Track[] = [];

  try {
    const data = await fetchJsonWithTimeout<CuratedResponse>('/api/curated', 10000, externalSignal);
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

  return { indonesia, global, viral, indieRnb };
}
