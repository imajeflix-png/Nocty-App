import { AmbientColor, LyricLine } from '../types/music';

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
 * Cleans YouTube Music / Piped metadata noise for accurate LRCLIB lookups.
 */
export function cleanTrackMetaForLyrics(artist: string, title: string): { artist: string; title: string } {
  const cleanArtist = artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0]
    .trim();

  const cleanTitle = title
    .replace(/\s*\((Official|Audio|Music Video|Lyric Video|Lyrics|Visualizer|HD|HQ|Live|Explicit).*?\)/gi, '')
    .replace(/\s*\[(Official|Audio|Music Video|Lyric Video|Lyrics|Visualizer|HD|HQ|Live|Explicit).*?\]/gi, '')
    .replace(/\s*\((feat\.|ft\.|with)\s+[^)]+\)/gi, '')
    .replace(/\s*-\s*(Official|Lyrics|Audio).*$/gi, '')
    .trim();

  return {
    artist: cleanArtist || artist.trim(),
    title: cleanTitle || title.trim(),
  };
}

const FALLBACK_AMBIENTS: AmbientColor[] = [
  { r: 16, g: 185, b: 129, hex: '#10B981' },
  { r: 132, g: 204, b: 22, hex: '#84CC16' },
  { r: 20, g: 184, b: 166, hex: '#14B8A6' },
  { r: 163, g: 230, b: 53, hex: '#A3E635' },
  { r: 34, g: 197, b: 94, hex: '#22C55E' },
];

function deterministicAmbient(key: string): AmbientColor {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_AMBIENTS[Math.abs(hash) % FALLBACK_AMBIENTS.length];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts a luminous dominant ambient color from an album cover via offscreen canvas.
 * Falls back gracefully to a deterministic emerald-chartreuse tint if CORS blocks readback.
 */
export function extractCoverAmbientColor(imageUrl: string, fallbackKey: string): Promise<AmbientColor> {
  if (!imageUrl) {
    return Promise.resolve(deterministicAmbient(fallbackKey));
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = window.setTimeout(() => {
      resolve(deterministicAmbient(fallbackKey));
    }, 2200);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(deterministicAmbient(fallbackKey));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          // Skip near-pure black and washed-out white so the ambient glow carries color
          if (lum < 0.08 || lum > 0.92) continue;
          const weight = 0.25 + sat * 2.5;
          rSum += r * weight;
          gSum += g * weight;
          bSum += b * weight;
          weightSum += weight;
        }

        if (weightSum < 0.5) {
          resolve(deterministicAmbient(fallbackKey));
          return;
        }

        let r = Math.round(rSum / weightSum);
        let g = Math.round(gSum / weightSum);
        let b = Math.round(bSum / weightSum);

        // Lift brightness slightly if extracted tint is too dark for a dark-mode radial glow
        const avgLum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (avgLum < 0.32) {
          const lift = 0.35 / Math.max(0.1, avgLum);
          r = Math.min(230, Math.round(r * lift));
          g = Math.min(235, Math.round(g * lift));
          b = Math.min(230, Math.round(b * lift));
        }

        resolve({ r, g, b, hex: rgbToHex(r, g, b) });
      } catch {
        resolve(deterministicAmbient(fallbackKey));
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(deterministicAmbient(fallbackKey));
    };

    img.src = imageUrl;
  });
}
