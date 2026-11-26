import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CatalogTrack {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  audioUrl?: string;
  fallbackAudioUrls?: string[];
  sourceType: 'online';
  isPreview?: boolean;
}

interface InnerTubeRun {
  text?: string;
}

interface InnerTubeVideoRenderer {
  videoId?: string;
  title?: { runs?: InnerTubeRun[]; simpleText?: string };
  ownerText?: { runs?: InnerTubeRun[] };
  longBylineText?: { runs?: InnerTubeRun[] };
  lengthText?: { simpleText?: string };
}

interface SaavnQualityUrl {
  quality?: string;
  url?: string;
  link?: string;
}

interface SaavnSongItem {
  id?: string;
  name?: string;
  title?: string;
  duration?: number | string;
  album?: { name?: string } | string;
  primaryArtists?: string;
  artists?: {
    primary?: Array<{ name?: string }>;
    all?: Array<{ name?: string }>;
  };
  image?: SaavnQualityUrl[];
  downloadUrl?: SaavnQualityUrl[];
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

interface ItunesRssEntry {
  id?: { attributes?: { 'im:id'?: string } };
  'im:name'?: { label?: string };
  'im:artist'?: { label?: string };
  'im:collection'?: { 'im:name'?: { label?: string } };
  'im:image'?: Array<{ label?: string }>;
  link?: Array<{ attributes?: { href?: string; type?: string } }> | { attributes?: { href?: string } };
}

function decodeText(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function normalizeDedupKey(title: string, artist: string): string {
  const cleanT = title
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanA = artist
    .toLowerCase()
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${cleanT}::${cleanA}`;
}

function parseLengthSeconds(lengthText?: string): number {
  if (!lengthText) return 0;
  const parts = lengthText
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function cleanChannelName(owner?: string): string {
  if (!owner) return 'Artis';
  return (
    decodeText(owner)
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*Official$/i, '')
      .replace(/VEVO$/i, '')
      .trim() || 'Artis'
  );
}

function cleanMusicTitleAndArtist(rawTitle: string, rawOwner?: string): { title: string; artist: string } {
  const cleaned = decodeText(rawTitle)
    .replace(
      /\s*[\(\[]\s*(Official\s*(Music\s*)?Video|Official\s*Lyric\s*Video|Official\s*Audio|Lyric\s*Video|Lyrics?|Lirik|Audio|Visualizer|HD|HQ|4K|MV|Live\s*Performance|Stripped\s*Version(?:\s*-\s*Official\s*Audio)?)\s*[\)\]]/gi,
      ''
    )
    .replace(/\s*\|\s*(Official|Lyrics?|Lirik|Audio).*$/gi, '')
    .trim();

  const fallbackArtist = cleanChannelName(rawOwner);
  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx > 0 && dashIdx < cleaned.length - 3) {
    const left = cleaned.slice(0, dashIdx).trim();
    const right = cleaned.slice(dashIdx + 3).trim();
    if (left.length <= 48 && right.length >= 2) {
      return {
        artist: left,
        title: right,
      };
    }
  }

  return {
    artist: fallbackArtist,
    title: cleaned || decodeText(rawTitle),
  };
}

function scoreEmbedFriendly(rawTitle: string, rawOwner: string): number {
  const t = rawTitle.toLowerCase();
  const o = rawOwner.toLowerCase();
  let score = 0;
  if (o.endsWith('- topic')) score += 5;
  if (t.includes('official audio')) score += 4;
  if (t.includes('lyric video') || t.includes('lyrics') || t.includes('lirik')) score += 3;
  if (t.includes('audio')) score += 2;
  if (t.includes('official music video') || t.includes('mv')) score -= 1;
  return score;
}

function extractVideoRenderers(payload: unknown): InnerTubeVideoRenderer[] {
  const root = payload as {
    contents?: {
      twoColumnSearchResultsRenderer?: {
        primaryContents?: {
          sectionListRenderer?: {
            contents?: Array<{
              itemSectionRenderer?: {
                contents?: Array<{ videoRenderer?: InnerTubeVideoRenderer }>;
              };
            }>;
          };
        };
      };
    };
  };

  const sections =
    root?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const results: InnerTubeVideoRenderer[] = [];

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      if (item?.videoRenderer?.videoId) {
        results.push(item.videoRenderer);
      }
    }
  }
  return results;
}

async function queryYouTubeInnerTube(query: string, limit: number): Promise<CatalogTrack[]> {
  const response = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20241126.01.00',
        },
      },
      query,
    }),
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`YouTube search HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  const renderers = extractVideoRenderers(data);
  const wantsLong = /mix|album|mashup|medley|playlist|live\s+concert/i.test(query);

  const candidates: Array<{ track: CatalogTrack; score: number }> = [];
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  for (const vr of renderers) {
    const videoId = vr.videoId;
    if (!videoId || seenIds.has(videoId)) continue;

    const rawTitle =
      vr.title?.runs?.map((r) => r.text || '').join('') || vr.title?.simpleText || '';
    if (!rawTitle) continue;

    if (!wantsLong && /\b(full\s*album|playlist|kumpulan\s*lagu|nonstop|1\s*jam|compil)/i.test(rawTitle)) {
      continue;
    }

    const duration = parseLengthSeconds(vr.lengthText?.simpleText);
    if (duration < 45 || (!wantsLong && duration > 720)) continue;

    const rawOwner =
      vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || '';
    const { title, artist } = cleanMusicTitleAndArtist(rawTitle, rawOwner);
    const dedupKey = normalizeDedupKey(title, artist);
    if (seenKeys.has(dedupKey)) continue;

    seenIds.add(videoId);
    seenKeys.add(dedupKey);

    candidates.push({
      score: scoreEmbedFriendly(rawTitle, rawOwner),
      track: {
        id: `yt-${videoId}`,
        videoId,
        title,
        artist,
        album: 'YouTube Music',
        duration,
        coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        sourceType: 'online',
        isPreview: false,
      },
    });
  }

  return candidates
    .map((item, idx) => ({ item, rank: idx - item.score * 0.45 }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((entry) => entry.item.track);
}

function parseQualityScore(quality?: string): number {
  if (!quality) return 0;
  const m = quality.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function queryJioSaavn(query: string, limit = 30): Promise<CatalogTrack[]> {
  const endpoints = [
    `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
    `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: { results?: SaavnSongItem[] };
        results?: SaavnSongItem[];
      };
      const items = json?.data?.results || json?.results || [];
      if (!Array.isArray(items) || items.length === 0) continue;

      const mapped: CatalogTrack[] = [];
      for (const item of items) {
        const title = decodeText(item.name || item.title || '');
        if (!title) continue;
        if (/karaoke\s*version/i.test(title) && !/karaoke/i.test(query)) continue;

        const artistList =
          item.artists?.primary?.map((a) => decodeText(a.name || '')).filter(Boolean) || [];
        const artist =
          artistList.join(', ') ||
          (item.primaryArtists ? decodeText(item.primaryArtists) : '') ||
          item.artists?.all?.[0]?.name ||
          'Artis';

        const albumRaw = typeof item.album === 'string' ? item.album : item.album?.name;
        const album = albumRaw ? decodeText(albumRaw) : 'Single';

        const images = [...(item.image || [])]
          .map((i) => ({ url: i.url || i.link || '', score: parseQualityScore(i.quality) }))
          .filter((i) => i.url.startsWith('http'))
          .sort((a, b) => b.score - a.score);

        const downloads = [...(item.downloadUrl || [])]
          .map((d) => ({ url: d.url || d.link || '', score: parseQualityScore(d.quality) }))
          .filter((d) => d.url.startsWith('http'))
          .sort((a, b) => b.score - a.score)
          .map((d) => d.url);

        const dur =
          typeof item.duration === 'number'
            ? item.duration
            : typeof item.duration === 'string'
              ? parseInt(item.duration, 10)
              : 210;

        mapped.push({
          id: `saavn-${item.id || Math.random().toString(36).slice(2, 9)}`,
          title,
          artist,
          album,
          duration: Number.isFinite(dur) && dur > 0 ? dur : 210,
          coverUrl: images[0]?.url || '',
          audioUrl: downloads[0],
          fallbackAudioUrls: downloads.slice(1),
          sourceType: 'online',
          isPreview: false,
        });
      }
      if (mapped.length > 0) return mapped;
    } catch {
      // Try next mirror
    }
  }
  return [];
}

async function queryItunes(query: string, limit = 30): Promise<CatalogTrack[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: ItunesSearchResult[] };
    const results = Array.isArray(json?.results) ? json.results : [];

    return results
      .filter((r) => Boolean(r.trackName && r.artistName))
      .map((r) => ({
        id: `itunes-${r.trackId ?? Math.random().toString(36).slice(2, 9)}`,
        title: decodeText(r.trackName || 'Lagu'),
        artist: decodeText(r.artistName || 'Artis'),
        album: decodeText(r.collectionName || 'Single'),
        duration: r.trackTimeMillis && r.trackTimeMillis > 0 ? Math.round(r.trackTimeMillis / 1000) : 210,
        coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '600x600bb') : '',
        audioUrl: r.previewUrl,
        sourceType: 'online' as const,
        isPreview: false,
      }));
  } catch {
    return [];
  }
}

async function fetchAppleTopChart(country: string, limit = 20): Promise<CatalogTrack[]> {
  try {
    const url = `https://itunes.apple.com/${encodeURIComponent(country)}/rss/topsongs/limit=${limit}/json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!res.ok) return [];
    const json = (await res.json()) as { feed?: { entry?: ItunesRssEntry[] } };
    const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];

    return entries
      .map((entry, idx) => {
        const title = decodeText(entry['im:name']?.label || '');
        const artist = decodeText(entry['im:artist']?.label || '');
        if (!title || !artist) return null;

        const imgs = entry['im:image'] || [];
        const rawImg = imgs[imgs.length - 1]?.label || '';
        const coverUrl = rawImg
          ? rawImg.replace(/\d+x\d+bb/, '600x600bb')
          : '';

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
          album: decodeText(entry['im:collection']?.['im:name']?.label || 'Top Charts'),
          duration: 210,
          coverUrl,
          audioUrl: previewUrl,
          sourceType: 'online' as const,
          isPreview: false,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  } catch {
    return [];
  }
}

function scoreTrackRelevance(track: CatalogTrack, query: string, orderIdx: number): number {
  const q = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!q) return -orderIdx * 0.1;

  const t = track.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const a = track.artist
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let score = -orderIdx * 0.15;

  if (a === q) score += 24;
  else if (a.startsWith(q) || a.includes(q)) score += 14;

  if (t === q) score += 18;
  else if (t.startsWith(q) || t.includes(q)) score += 8;

  const qTokens = q.split(' ').filter((tok) => tok.length >= 2);
  if (qTokens.length > 1) {
    const matched = qTokens.filter((tok) => a.includes(tok) || t.includes(tok)).length;
    score += matched * 3;
  }

  const combinedRaw = `${track.title} ${track.artist}`.toLowerCase();
  if (
    !/(karaoke|masala|biography|tribute|ringtone|parody|rimek|mashup)/.test(q) &&
    /\b(karaoke|masala|biography|song\s+for|not\s+a\s+.*song|tribute|ringtone|dj\s+viral\s+rimek)\b/i.test(
      combinedRaw
    )
  ) {
    score -= 30;
  }

  return score;
}

function mergeAndDeduplicate(lists: CatalogTrack[][], limit: number, query = ''): CatalogTrack[] {
  const merged: CatalogTrack[] = [];
  const byKey = new Map<string, number>();

  const maxLen = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < maxLen && merged.length < limit * 2; i++) {
    for (const list of lists) {
      const track = list[i];
      if (!track || !track.title) continue;
      const key = normalizeDedupKey(track.title, track.artist);
      const existingIdx = byKey.get(key);
      if (existingIdx !== undefined) {
        const existing = merged[existingIdx];
        if (!existing.coverUrl && track.coverUrl) existing.coverUrl = track.coverUrl;
        if (!existing.videoId && track.videoId) existing.videoId = track.videoId;
        if (!existing.audioUrl && track.audioUrl) existing.audioUrl = track.audioUrl;
        continue;
      }
      byKey.set(key, merged.length);
      merged.push(track);
    }
  }

  if (!query.trim()) {
    return merged.slice(0, limit);
  }

  return merged
    .map((track, idx) => ({ track, score: scoreTrackRelevance(track, query, idx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.track);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Combined Global + Indonesian Music Search (JioSaavn limit=30 + iTunes limit=30 -> up to 40 deduplicated tracks)
  app.get('/api/music-search', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 140) : '';
    if (!rawQ) {
      res.status(400).json({ error: 'Query parameter q is required', tracks: [] });
      return;
    }

    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 40;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 40;

    try {
      const [itunesRes, saavnRes] = await Promise.allSettled([
        queryItunes(rawQ, 30),
        queryJioSaavn(rawQ, 30),
      ]);

      const itunesTracks = itunesRes.status === 'fulfilled' ? itunesRes.value : [];
      const saavnTracks = saavnRes.status === 'fulfilled' ? saavnRes.value : [];

      let merged = mergeAndDeduplicate([itunesTracks, saavnTracks], limit, rawQ);

      // Supplement with YouTube search when a niche local/indie query needs deeper coverage
      if (merged.length < 12) {
        const ytFallback = await queryYouTubeInnerTube(`${rawQ} official audio`, 20).catch(() => []);
        merged = mergeAndDeduplicate([merged, ytFallback], limit, rawQ);
      }

      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json({ tracks: merged });
    } catch {
      res.status(502).json({ error: 'Search unavailable', tracks: [] });
    }
  });

  // Live Official Top Charts: Top Hits Indonesia (ID RSS), Global Top 50 (US RSS), Viral & Indie
  app.get('/api/curated', async (_req, res) => {
    try {
      const [idChart, globalChart, gbChart, indieHindia, indieNiki, rnbSza] = await Promise.allSettled([
        fetchAppleTopChart('id', 20),
        fetchAppleTopChart('us', 20),
        fetchAppleTopChart('gb', 20),
        queryItunes('Hindia', 10),
        queryItunes('NIKI', 10),
        queryItunes('SZA', 10),
      ]);

      const pick = (r: PromiseSettledResult<CatalogTrack[]>) =>
        r.status === 'fulfilled' ? r.value : [];

      const indonesia = pick(idChart).slice(0, 20);
      const global = pick(globalChart).slice(0, 20);
      const viral = pick(gbChart).slice(0, 20);
      const indieRnb = mergeAndDeduplicate([pick(indieHindia), pick(indieNiki), pick(rnbSza)], 20);

      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({ indonesia, global, viral, indieRnb });
    } catch {
      res.status(502).json({ indonesia: [], global: [], viral: [], indieRnb: [] });
    }
  });

  // YouTube videoId search & background resolver
  app.get('/api/yt-search', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 140) : '';
    if (!rawQ) {
      res.status(400).json({ error: 'Query parameter q is required', tracks: [] });
      return;
    }

    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 16;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(40, rawLimit)) : 16;

    const hasAudioHint = /\b(audio|lyrics?|lirik|song|lagu|remix|cover|live|acoustic|akustik|lofi|beats)\b/i.test(
      rawQ
    );
    const effectiveQuery = hasAudioHint ? rawQ : `${rawQ} official audio`;

    try {
      let tracks = await queryYouTubeInnerTube(effectiveQuery, limit);
      if (tracks.length < 3 && effectiveQuery !== rawQ) {
        const fallbackTracks = await queryYouTubeInnerTube(rawQ, limit);
        const existingIds = new Set(tracks.map((t) => t.videoId));
        for (const ft of fallbackTracks) {
          if (!existingIds.has(ft.videoId)) {
            tracks.push(ft);
          }
        }
        tracks = tracks.slice(0, limit);
      }

      res.setHeader('Cache-Control', 'public, max-age=180');
      res.json({ tracks });
    } catch {
      res.status(502).json({ error: 'Search unavailable', tracks: [] });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Nocty server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
