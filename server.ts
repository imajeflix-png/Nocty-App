import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface CatalogTrack {
  id: string;
  videoId?: string;
  title: string;
  rawTitle?: string;
  channelName?: string;
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

interface DeezerSearchItem {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_xl?: string; cover_big?: string; cover_medium?: string };
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

function normalizeSearchText(input: string): string {
  return decodeText(input)
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

const OFFICIAL_CHANNEL_REGEX =
  /(vevo|official|records|music|entertainment|musica|aquarius|nagaswara|trinity|sony|warner|universal|88rising|label|studio|proaktif|blackboard|ascada|pelangi|falcon|\s-\s*topic$)/i;

const AMATEUR_VIDEO_REGEX =
  /\b(karaoke|smule|starmaker|guitar\s*cover|piano\s*cover|drum\s*cover|bass\s*cover|violin\s*cover|vocal\s*cover|acoustic\s*cover|slowed|reverb|nightcore|8d\s*audio|sped\s*up|fan\s*made|fanmade|parody|reaction|tutorial|chord|ringtone)\b/i;

function isOfficialChannelOrLabel(channelOwner: string): boolean {
  return Boolean(channelOwner && OFFICIAL_CHANNEL_REGEX.test(channelOwner));
}

function isAmateurOrUnofficialCover(rawTitle: string, channelOwner: string): boolean {
  if (AMATEUR_VIDEO_REGEX.test(rawTitle)) return true;
  if (/\bcover\b/i.test(rawTitle)) {
    const hasOfficialTag = /\bofficial\b/i.test(rawTitle) || isOfficialChannelOrLabel(channelOwner);
    return !hasOfficialTag;
  }
  return false;
}

function scoreOfficialMusicVideo(rawTitle: string, channelOwner: string): number {
  const t = rawTitle.toLowerCase();
  const c = channelOwner.toLowerCase();
  if (isAmateurOrUnofficialCover(rawTitle, channelOwner)) return -100;

  let score = 0;
  if (t.includes('official music video')) score += 20;
  if (t.includes('official mv')) score += 18;
  if (t.includes('official video')) score += 16;
  if (t.includes('music video') || /\bmv\b/.test(t)) score += 12;
  if (t.includes('official audio')) score += 7;
  if (t.includes('visualizer')) score += 3;
  if (t.includes('lyric video') || /\b(lyrics?|lirik)\b/.test(t)) {
    score += isOfficialChannelOrLabel(channelOwner) ? 1 : -6;
  }
  if (t.includes('audio only') || t.includes('static')) score -= 6;
  if (t.includes('live') || t.includes('acoustic')) score -= 3;
  if (isOfficialChannelOrLabel(channelOwner)) {
    score += 8;
  }
  if (c.endsWith('- topic')) score -= 5;
  return score;
}

async function queryYouTubeInnerTube(
  query: string,
  limit: number,
  mode: 'audio' | 'mv' = 'audio'
): Promise<CatalogTrack[]> {
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
  const wantsAmateur = /\b(karaoke|cover|reaction|tutorial|slowed|reverb|nightcore|sped\s*up)\b/i.test(query);

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

    const rawOwner =
      vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || '';

    if (mode === 'mv') {
      if (isAmateurOrUnofficialCover(rawTitle, rawOwner)) continue;
    } else if (!wantsAmateur && isAmateurOrUnofficialCover(rawTitle, rawOwner)) {
      continue;
    }

    const duration = parseLengthSeconds(vr.lengthText?.simpleText);
    if (duration < 45 || (!wantsLong && duration > 720)) continue;

    const { title, artist } = cleanMusicTitleAndArtist(rawTitle, rawOwner);
    const dedupKey = mode === 'mv' ? videoId : normalizeDedupKey(title, artist);
    if (seenKeys.has(dedupKey)) continue;

    seenIds.add(videoId);
    seenKeys.add(dedupKey);

    candidates.push({
      score:
        mode === 'mv'
          ? scoreOfficialMusicVideo(rawTitle, rawOwner)
          : scoreEmbedFriendly(rawTitle, rawOwner),
      track: {
        id: `yt-${videoId}`,
        videoId,
        title,
        rawTitle: decodeText(rawTitle),
        channelName: decodeText(rawOwner),
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
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=ID&lang=id_id&media=music&entity=song&limit=${limit}`;
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

async function queryDeezer(query: string, limit = 25): Promise<CatalogTrack[]> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DeezerSearchItem[] };
    const items = Array.isArray(json?.data) ? json.data : [];

    return items
      .filter((r) => Boolean(r.title && r.artist?.name))
      .map((r) => ({
        id: `deezer-${r.id ?? Math.random().toString(36).slice(2, 9)}`,
        title: decodeText(r.title || 'Lagu'),
        artist: decodeText(r.artist?.name || 'Artis'),
        album: decodeText(r.album?.title || 'Single'),
        duration: r.duration && r.duration > 0 ? Math.round(r.duration) : 210,
        coverUrl: r.album?.cover_xl || r.album?.cover_big || r.album?.cover_medium || '',
        audioUrl: r.preview,
        sourceType: 'online' as const,
        isPreview: false,
      }));
  } catch {
    return [];
  }
}

async function queryPipedMusicFallback(query: string, limit = 15): Promise<CatalogTrack[]> {
  const pipedMirrors = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.private.coffee',
  ];

  for (const mirror of pipedMirrors) {
    try {
      const url = `${mirror}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        items?: Array<{
          url?: string;
          title?: string;
          uploaderName?: string;
          thumbnail?: string;
          duration?: number;
        }>;
      };
      const items = Array.isArray(json?.items) ? json.items : [];
      const mapped: CatalogTrack[] = [];
      for (const item of items) {
        const match = item.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || item.url?.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        const videoId = match?.[1];
        if (!videoId || !item.title) continue;
        const dur = item.duration && item.duration > 40 ? Math.round(item.duration) : 210;
        const { title, artist } = cleanMusicTitleAndArtist(item.title, item.uploaderName);
        mapped.push({
          id: `yt-${videoId}`,
          videoId,
          title,
          artist,
          album: 'YouTube Music',
          duration: dur,
          coverUrl: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          sourceType: 'online',
          isPreview: false,
        });
        if (mapped.length >= limit) break;
      }
      if (mapped.length > 0) return mapped;
    } catch {
      // Try next mirror
    }
  }
  return [];
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
  const q = normalizeSearchText(query);
  if (!q) return -orderIdx * 0.1;

  const t = normalizeSearchText(track.title);
  const a = normalizeSearchText(track.artist);
  const qCompact = compactSearchText(query);
  const tCompact = compactSearchText(track.title);
  const aCompact = compactSearchText(track.artist);
  const combinedCompact = `${tCompact}${aCompact}`;

  let score = -orderIdx * 0.12;

  // Exact or substring normalized match
  if (a === q) score += 26;
  else if (a.startsWith(q) || a.includes(q)) score += 15;

  if (t === q) score += 28;
  else if (t.startsWith(q)) score += 18;
  else if (t.includes(q)) score += 12;

  // Compact match catches joined/split Indonesian queries like "rumah kerumah" -> "Rumah Ke Rumah"
  if (qCompact.length >= 4) {
    if (tCompact === qCompact) score += 32;
    else if (tCompact.includes(qCompact)) score += 24;
    else if (aCompact === qCompact) score += 24;
    else if (combinedCompact.includes(qCompact)) score += 18;
    else {
      const simTitle = bigramSimilarity(qCompact, tCompact);
      const simCombined = bigramSimilarity(qCompact, `${tCompact}${aCompact}`);
      const bestSim = Math.max(simTitle, simCombined);
      if (bestSim >= 0.55) {
        score += bestSim * 22;
      }
    }
  }

  // Fuzzy token matching (handles spelling typos per word)
  const qTokens = q.split(' ').filter((tok) => tok.length >= 2);
  const targetTokens = `${t} ${a}`.split(' ').filter((tok) => tok.length >= 2);
  if (qTokens.length > 0) {
    let tokenScore = 0;
    for (const qt of qTokens) {
      if (a.includes(qt) || t.includes(qt)) {
        tokenScore += 4.5;
        continue;
      }
      const maxDist = qt.length >= 7 ? 2 : qt.length >= 4 ? 1 : 0;
      if (maxDist > 0) {
        const fuzzyHit = targetTokens.some((tt) => levenshteinDistance(qt, tt) <= maxDist);
        if (fuzzyHit) {
          tokenScore += 3.2;
        }
      }
    }
    score += tokenScore;
  }

  // Prefer playable full-duration tracks (especially with resolved YouTube videoId)
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
        if (!existing.rawTitle && track.rawTitle) existing.rawTitle = track.rawTitle;
        if (!existing.channelName && track.channelName) existing.channelName = track.channelName;
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

  // Parallel Global + Indonesian Catalog + Smart YouTube Song Search (iTunes ID + Deezer + JioSaavn + YouTube)
  app.get('/api/music-search', async (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 140) : '';
    if (!rawQ) {
      res.status(400).json({ error: 'Query parameter q is required', tracks: [] });
      return;
    }

    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 40;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 40;
    const tokenCount = rawQ.split(/\s+/).filter(Boolean).length;
    const hasHint = /\b(audio|lyrics?|lirik|song|lagu|remix|cover|live|acoustic|official|mv|video)\b/i.test(rawQ);
    const ytSongQuery = hasHint || tokenCount >= 2 ? rawQ : `${rawQ} lagu official`;

    try {
      const [itunesRes, deezerRes, saavnRes, ytRes] = await Promise.allSettled([
        queryItunes(rawQ, 25),
        queryDeezer(rawQ, 25),
        queryJioSaavn(rawQ, 20),
        queryYouTubeInnerTube(ytSongQuery, 24).then(async (tracks) =>
          tracks.length > 0 ? tracks : queryPipedMusicFallback(rawQ, 15)
        ),
      ]);

      const itunesTracks = itunesRes.status === 'fulfilled' ? itunesRes.value : [];
      const deezerTracks = deezerRes.status === 'fulfilled' ? deezerRes.value : [];
      const saavnTracks = saavnRes.status === 'fulfilled' ? saavnRes.value : [];
      const ytTracks = ytRes.status === 'fulfilled' ? ytRes.value : [];

      const merged = mergeAndDeduplicate(
        [itunesTracks, ytTracks, deezerTracks, saavnTracks],
        limit,
        rawQ
      );

      res.setHeader('Cache-Control', 'public, max-age=120');
      res.json({ tracks: merged });
    } catch {
      res.status(502).json({ error: 'Search unavailable', tracks: [] });
    }
  });

  // Gemini AI Mood Shuffle Endpoint: Analyzes current track audio features & filters queue by energy and tempo
  app.post('/api/gemini/mood-shuffle', async (req, res) => {
    const { currentTrack, candidateTracks, sessionTracks } = req.body || {};
    if (!currentTrack || !Array.isArray(candidateTracks) || candidateTracks.length === 0) {
      res.status(400).json({
        error: 'currentTrack and candidateTracks are required',
      });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'GEMINI_API_KEY belum diatur. Periksa panel Settings > Secrets.',
      });
      return;
    }

    const candidatesSlice = candidateTracks.slice(0, 40).map((t: any) => ({
      id: String(t.id),
      title: String(t.title || ''),
      artist: String(t.artist || ''),
      album: String(t.album || ''),
      duration: Number(t.duration || 210),
    }));
    const validIds = new Set(candidatesSlice.map((t: { id: string }) => t.id));

    const recentSessionSummary = Array.isArray(sessionTracks) && sessionTracks.length > 0
      ? sessionTracks
          .slice(0, 3)
          .map((t: any) => `"${t.title}" - ${t.artist}`)
          .join(', ')
      : 'None';

    try {
      const prompt = `Analyze the current track's audio features from its metadata and current listening session:
Current Track: "${currentTrack.title}" by "${currentTrack.artist}" (album: "${currentTrack.album || 'Unknown'}", duration: ${currentTrack.duration || 210}s)
Recent Session Context: ${recentSessionSummary}

1. Estimate the current track's energy level ("low", "medium", or "high"), tempo in BPM (integer), tempo feel ("Slow", "Mid-tempo", or "Upbeat"), and a concise 2-word mood profile (e.g. "Late Night", "Indie Chill", "Upbeat Pop").
2. Evaluate each candidate track below and filter which ones genuinely match the energy and tempo of this current listening session ("matchedTrackIds", ordered from best match to least, keeping at least the top 3 closest matches if the pool is small).
3. Also provide "orderedTrackIds" ranking all candidates by closeness in energy and tempo.
4. Provide a short 1-sentence Indonesian summary explaining the session's vibe and tempo match.

Candidate tracks:
${JSON.stringify(candidatesSlice)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              energy: {
                type: Type.STRING,
                description: 'Estimated energy level: low, medium, or high.',
              },
              tempoBpm: {
                type: Type.INTEGER,
                description: 'Estimated tempo in beats per minute (BPM).',
              },
              tempoLabel: {
                type: Type.STRING,
                description: 'Tempo feel label: Slow, Mid-tempo, or Upbeat.',
              },
              moodProfile: {
                type: Type.STRING,
                description: 'Concise 2-word mood profile for the current session.',
              },
              summary: {
                type: Type.STRING,
                description: 'Short 1-sentence Indonesian summary of the analyzed energy and tempo.',
              },
              matchedTrackIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Candidate track IDs that match the session energy and tempo, best match first.',
              },
              orderedTrackIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'All candidate track IDs ordered by energy and tempo similarity.',
              },
            },
            required: [
              'energy',
              'tempoBpm',
              'tempoLabel',
              'moodProfile',
              'summary',
              'matchedTrackIds',
              'orderedTrackIds',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const matchedTrackIds: string[] = Array.isArray(parsed.matchedTrackIds)
        ? Array.from(new Set(parsed.matchedTrackIds.filter((id: unknown): id is string => typeof id === 'string' && validIds.has(id))))
        : [];
      const orderedTrackIds: string[] = Array.isArray(parsed.orderedTrackIds)
        ? Array.from(new Set(parsed.orderedTrackIds.filter((id: unknown): id is string => typeof id === 'string' && validIds.has(id))))
        : [];

      // Append any valid candidate IDs omitted by the model to orderedTrackIds
      for (const c of candidatesSlice) {
        if (!orderedTrackIds.includes(c.id)) {
          orderedTrackIds.push(c.id);
        }
      }

      res.json({
        energy: typeof parsed.energy === 'string' ? parsed.energy : 'medium',
        tempoBpm: Number.isFinite(parsed.tempoBpm) ? Math.max(50, Math.min(200, Math.round(parsed.tempoBpm))) : 110,
        tempoLabel: typeof parsed.tempoLabel === 'string' ? parsed.tempoLabel : 'Mid-tempo',
        moodProfile: typeof parsed.moodProfile === 'string' ? parsed.moodProfile : 'Session Flow',
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Antrean disesuaikan dengan energi dan tempo sesi saat ini.',
        matchedTrackIds: matchedTrackIds.length > 0 ? matchedTrackIds : orderedTrackIds,
        orderedTrackIds,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menganalisis mood via Gemini API';
      const status = /403|PERMISSION_DENIED|API_KEY_INVALID/i.test(msg)
        ? 403
        : /429|RESOURCE_EXHAUSTED/i.test(msg)
          ? 429
          : 502;
      res.status(status).json({ error: msg });
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
    const mode = req.query.mode === 'mv' ? 'mv' : 'audio';

    const tokenCount = rawQ.split(/\s+/).filter(Boolean).length;
    const hasMediaHint =
      mode === 'mv' ||
      tokenCount >= 2 ||
      /\b(audio|lyrics?|lirik|song|lagu|remix|cover|live|acoustic|akustik|lofi|beats|music\s*video|official\s*video|official\s*mv|official\s*audio|\bmv\b)\b/i.test(
        rawQ
      );
    const effectiveQuery = hasMediaHint ? rawQ : `${rawQ} official`;

    try {
      let tracks = await queryYouTubeInnerTube(effectiveQuery, limit, mode);
      if (mode !== 'mv' && tracks.length < 3 && effectiveQuery !== rawQ) {
        const fallbackTracks = await queryYouTubeInnerTube(rawQ, limit, mode);
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
