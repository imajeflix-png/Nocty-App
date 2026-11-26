import { Track } from '../types/music';
import { DEFAULT_COVER_URL } from '../data/moods';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.leptons.xyz',
  'https://api.piped.private.coffee',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
];

let preferredInstanceIndex = 0;

interface PipedSearchItem {
  url?: string;
  type?: string;
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  duration?: number;
}

interface PipedAudioStream {
  url?: string;
  format?: string;
  mimeType?: string;
  bitrate?: number;
  videoOnly?: boolean;
}

interface PipedStreamResponse {
  audioStreams?: PipedAudioStream[];
  title?: string;
  uploader?: string;
  duration?: number;
  thumbnailUrl?: string;
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

function getOrderedInstances(): string[] {
  const ordered = [
    PIPED_INSTANCES[preferredInstanceIndex],
    ...PIPED_INSTANCES.filter((_, idx) => idx !== preferredInstanceIndex),
  ];
  return ordered;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 5500, externalSignal?: AbortSignal): Promise<T> {
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

export function extractVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  const vMatch = urlOrId.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];
  const shortMatch = urlOrId.match(/\/([a-zA-Z0-9_-]{11})(?:$|\?)/);
  return shortMatch ? shortMatch[1] : null;
}

function upgradeThumbnailUrl(thumbnail?: string, videoId?: string): string {
  if (thumbnail && thumbnail.startsWith('http')) {
    return thumbnail;
  }
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  return DEFAULT_COVER_URL;
}

/**
 * Queries Piped Search API (filter=music_songs) with multi-instance automatic failover.
 * Falls back to iTunes Search API only if all public Piped mirrors fail simultaneously.
 */
export async function searchOnlineTracks(
  query: string,
  externalSignal?: AbortSignal
): Promise<{ tracks: Track[]; source: 'piped' | 'itunes-fallback' }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { tracks: [], source: 'piped' };
  }

  const instances = getOrderedInstances();
  for (let i = 0; i < instances.length; i++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const baseUrl = instances[i];
    try {
      const endpoint = `${baseUrl}/search?q=${encodeURIComponent(trimmed)}&filter=music_songs`;
      const data = await fetchJsonWithTimeout<{ items?: PipedSearchItem[] }>(endpoint, 5500, externalSignal);
      const items = Array.isArray(data?.items) ? data.items : [];

      const mapped: Track[] = [];
      const seenIds = new Set<string>();

      for (const item of items) {
        if (item.type && item.type !== 'stream') continue;
        const videoId = item.url ? extractVideoId(item.url) : null;
        if (!videoId || seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        mapped.push({
          id: `piped-${videoId}`,
          videoId,
          title: item.title?.trim() || 'Lagu Tanpa Judul',
          artist: (item.uploaderName || 'Artis Tidak Diketahui').replace(/\s*-\s*Topic$/i, '').trim(),
          album: 'YouTube Music',
          duration: typeof item.duration === 'number' && item.duration > 0 ? item.duration : 210,
          coverUrl: upgradeThumbnailUrl(item.thumbnail, videoId),
          sourceType: 'online',
          isPreview: false,
          lyrics: [],
          lyricsStatus: 'idle',
          createdAt: Date.now(),
        });
      }

      if (mapped.length > 0) {
        const globalIdx = PIPED_INSTANCES.indexOf(baseUrl);
        if (globalIdx !== -1) preferredInstanceIndex = globalIdx;
        return { tracks: mapped, source: 'piped' };
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
        throw err;
      }
      // Try next healthy Piped mirror
    }
  }

  // Graceful fallback to iTunes Search API if all Piped mirrors are currently unreachable
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&media=music&limit=20`;
    const data = await fetchJsonWithTimeout<{ results?: ItunesSearchResult[] }>(itunesUrl, 6000, externalSignal);
    const results = Array.isArray(data?.results) ? data.results : [];
    const fallbackTracks: Track[] = results
      .filter((r) => r.previewUrl && r.trackName)
      .map((r) => ({
        id: `itunes-${r.trackId ?? Math.random().toString(36).slice(2)}`,
        title: r.trackName || 'Lagu',
        artist: r.artistName || 'Artis',
        album: r.collectionName || 'Single',
        duration: r.trackTimeMillis ? Math.min(30, Math.round(r.trackTimeMillis / 1000)) : 30,
        coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '600x600bb') : DEFAULT_COVER_URL,
        audioUrl: r.previewUrl,
        sourceType: 'preview' as const,
        isPreview: true,
        lyrics: [],
        lyricsStatus: 'idle' as const,
        createdAt: Date.now(),
      }));

    if (fallbackTracks.length > 0) {
      return { tracks: fallbackTracks, source: 'itunes-fallback' };
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
      throw err;
    }
  }

  throw new Error('Server streaming Piped sedang sibuk. Coba muat ulang beberapa saat lagi.');
}

function pickBestAudioStream(streams: PipedAudioStream[]): string | null {
  const valid = streams.filter((s) => s.url && !s.videoOnly);
  if (valid.length === 0) return null;

  // Prefer M4A / MP4 (universally supported by HTML5 <audio> including Safari & Chrome)
  const m4aStreams = valid
    .filter((s) => (s.mimeType || '').includes('mp4') || (s.format || '').toLowerCase() === 'm4a')
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (m4aStreams.length > 0 && m4aStreams[0].url) {
    return m4aStreams[0].url;
  }

  // Fallback to highest bitrate WebM / Opus audio stream
  const sortedAll = [...valid].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return sortedAll[0]?.url || null;
}

/**
 * Resolves the highest-bitrate full-track audio stream URL from Piped /streams/:videoId.
 */
export async function resolvePipedStreamUrl(
  videoId: string,
  externalSignal?: AbortSignal
): Promise<string> {
  const instances = getOrderedInstances();
  let lastError: Error | null = null;

  for (let i = 0; i < instances.length; i++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const baseUrl = instances[i];
    try {
      const endpoint = `${baseUrl}/streams/${encodeURIComponent(videoId)}`;
      const data = await fetchJsonWithTimeout<PipedStreamResponse>(endpoint, 6500, externalSignal);
      const streams = Array.isArray(data?.audioStreams) ? data.audioStreams : [];
      const bestUrl = pickBestAudioStream(streams);
      if (bestUrl) {
        const globalIdx = PIPED_INSTANCES.indexOf(baseUrl);
        if (globalIdx !== -1) preferredInstanceIndex = globalIdx;
        return bestUrl;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' && externalSignal?.aborted) {
        throw err;
      }
      lastError = err as Error;
    }
  }

  throw lastError || new Error('Stream audio tidak tersedia dari server Piped saat ini.');
}
