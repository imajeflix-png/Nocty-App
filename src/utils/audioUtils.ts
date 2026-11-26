import { AmbientColor, AmbientPalette, LyricLine } from '../types/music';

/**
 * True unbiased Fisher-Yates in-place shuffle on a cloned array.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Formats seconds into mm:ss with tabular-friendly zero padding.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Decodes common HTML entities returned by metadata APIs.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Parses standard LRC format strings ("[01:23.45] Lyric line") into sorted LyricLine[].
 */
export function parseLrcLyrics(lrc: string): LyricLine[] {
  if (!lrc) return [];
  const lines = lrc.split(/\r?\n/);
  const parsed: LyricLine[] = [];
  const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const matches = Array.from(rawLine.matchAll(timestampRegex));
    if (matches.length === 0) continue;

    const text = rawLine.replace(timestampRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fractionRaw = match[3] || '0';
      const fraction =
        fractionRaw.length === 3
          ? parseInt(fractionRaw, 10) / 1000
          : fractionRaw.length === 2
            ? parseInt(fractionRaw, 10) / 100
            : parseInt(fractionRaw, 10) / 10;

      const time = minutes * 60 + seconds + fraction;
      if (Number.isFinite(time)) {
        parsed.push({ time, text });
      }
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Cleans track metadata noise for accurate LRCLIB lookups.
 */
export function cleanTrackMetaForLyrics(artist: string, title: string): { artist: string; title: string } {
  const cleanArtist = decodeHtmlEntities(artist)
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0]
    .trim();

  const cleanTitle = decodeHtmlEntities(title)
    .replace(/\s*\((From|Official|Audio|Music Video|Lyric Video|Lyrics|Visualizer|HD|HQ|Live|Explicit).*?\)/gi, '')
    .replace(/\s*\[(Official|Audio|Music Video|Lyric Video|Lyrics|Visualizer|HD|HQ|Live|Explicit).*?\]/gi, '')
    .replace(/\s*\((feat\.|ft\.|with)\s+[^)]+\)/gi, '')
    .replace(/\s*-\s*(Official|Lyrics|Audio).*$/gi, '')
    .trim();

  return {
    artist: cleanArtist || artist.trim(),
    title: cleanTitle || title.trim(),
  };
}

const FALLBACK_PALETTES: AmbientPalette[] = [
  {
    primary: { r: 148, g: 163, b: 184, hex: '#94A3B8' },
    secondary: { r: 99, g: 102, b: 241, hex: '#6366F1' },
  },
  {
    primary: { r: 192, g: 132, b: 151, hex: '#C08497' },
    secondary: { r: 100, g: 116, b: 139, hex: '#64748B' },
  },
  {
    primary: { r: 96, g: 165, b: 250, hex: '#60A5FA' },
    secondary: { r: 45, g: 212, b: 191, hex: '#2DD4BF' },
  },
  {
    primary: { r: 217, g: 119, b: 87, hex: '#D97757' },
    secondary: { r: 129, g: 140, b: 248, hex: '#818CF8' },
  },
  {
    primary: { r: 167, g: 139, b: 250, hex: '#A78BFA' },
    secondary: { r: 56, g: 189, b: 248, hex: '#38BDF8' },
  },
];

function deterministicPalette(key: string): AmbientPalette {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_PALETTES[Math.abs(hash) % FALLBACK_PALETTES.length];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeSoftAmbient(r: number, g: number, b: number): AmbientColor {
  // Keep ambient light luminous enough on #0B0B0D without becoming harsh neon
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  let nr = r;
  let ng = g;
  let nb = b;

  if (lum < 0.36) {
    const lift = 0.42 / Math.max(0.12, lum);
    nr = Math.min(225, nr * lift);
    ng = Math.min(225, ng * lift);
    nb = Math.min(225, nb * lift);
  } else if (lum > 0.78) {
    const damp = 0.72 / lum;
    nr *= damp;
    ng *= damp;
    nb *= damp;
  }

  // Gently blend 12% toward neutral silver-white for Apple-like atmospheric softness
  nr = Math.round(nr * 0.88 + 210 * 0.12);
  ng = Math.round(ng * 0.88 + 215 * 0.12);
  nb = Math.round(nb * 0.88 + 225 * 0.12);

  return { r: nr, g: ng, b: nb, hex: rgbToHex(nr, ng, nb) };
}

function colorDistance(a: AmbientColor, b: AmbientColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Extracts 2 soft dominant colors from an album cover via offscreen canvas
 * using 12 hue buckets + neutral fallback so ambient radial meshes reflect the album mood.
 */
export function extractCoverAmbientPalette(
  imageUrl: string,
  fallbackKey: string
): Promise<AmbientPalette> {
  if (!imageUrl) {
    return Promise.resolve(deterministicPalette(fallbackKey));
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = window.setTimeout(() => {
      resolve(deterministicPalette(fallbackKey));
    }, 2200);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const size = 28;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(deterministicPalette(fallbackKey));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = Array.from({ length: 12 }, () => ({
          rSum: 0,
          gSum: 0,
          bSum: 0,
          weight: 0,
        }));

        let allR = 0;
        let allG = 0;
        let allB = 0;
        let allW = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const sat = max === 0 ? 0 : delta / max;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          if (lum < 0.08 || lum > 0.94) continue;

          const baseW = 0.25 + sat * 2.2;
          allR += r * baseW;
          allG += g * baseW;
          allB += b * baseW;
          allW += baseW;

          if (delta < 12) continue;

          let hue = 0;
          if (max === r) {
            hue = ((g - b) / delta) % 6;
          } else if (max === g) {
            hue = (b - r) / delta + 2;
          } else {
            hue = (r - g) / delta + 4;
          }
          hue = ((hue * 60) + 360) % 360;
          const bucketIdx = Math.floor(hue / 30) % 12;

          buckets[bucketIdx].rSum += r * baseW;
          buckets[bucketIdx].gSum += g * baseW;
          buckets[bucketIdx].bSum += b * baseW;
          buckets[bucketIdx].weight += baseW;
        }

        const sortedBuckets = buckets
          .filter((b) => b.weight > 0.5)
          .sort((a, b) => b.weight - a.weight);

        if (sortedBuckets.length === 0) {
          if (allW > 0.5) {
            const single = normalizeSoftAmbient(allR / allW, allG / allW, allB / allW);
            const alt = normalizeSoftAmbient(
              (allR / allW) * 0.75 + 90,
              (allG / allW) * 0.8 + 100,
              (allB / allW) * 0.95 + 140
            );
            resolve({ primary: single, secondary: alt });
            return;
          }
          resolve(deterministicPalette(fallbackKey));
          return;
        }

        const b1 = sortedBuckets[0];
        const primary = normalizeSoftAmbient(
          b1.rSum / b1.weight,
          b1.gSum / b1.weight,
          b1.bSum / b1.weight
        );

        let secondary: AmbientColor | null = null;
        for (let idx = 1; idx < sortedBuckets.length; idx++) {
          const candBucket = sortedBuckets[idx];
          const cand = normalizeSoftAmbient(
            candBucket.rSum / candBucket.weight,
            candBucket.gSum / candBucket.weight,
            candBucket.bSum / candBucket.weight
          );
          if (colorDistance(primary, cand) > 42) {
            secondary = cand;
            break;
          }
        }

        if (!secondary) {
          // Synthesize a complementary soft tonal counterpart from primary
          secondary = normalizeSoftAmbient(
            Math.max(40, Math.min(230, primary.b * 0.9 + 25)),
            Math.max(40, Math.min(230, primary.r * 0.6 + primary.g * 0.4)),
            Math.max(40, Math.min(230, primary.g * 0.55 + primary.b * 0.55 + 30))
          );
        }

        resolve({ primary, secondary });
      } catch {
        resolve(deterministicPalette(fallbackKey));
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(deterministicPalette(fallbackKey));
    };

    img.src = imageUrl;
  });
}
