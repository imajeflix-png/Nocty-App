import { getAppleEmojiCdnUrl, unifiedToFallbackGlyph } from '../components/AppleEmoji';

const emojiImageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadAppleEmojiCanvasImage(unified: string): Promise<HTMLImageElement | null> {
  const key = unified.toLowerCase();
  const cached = emojiImageCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const url = getAppleEmojiCdnUrl(key);
    const direct = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    if (direct) return direct;

    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => resolve(null);
        el.src = objUrl;
      });
      URL.revokeObjectURL(objUrl);
      return img;
    } catch {
      return null;
    }
  })();

  emojiImageCache.set(key, promise);
  return promise;
}

export function drawAppleEmojiOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  unified: string,
  x: number,
  y: number,
  size: number
): void {
  if (img) {
    ctx.drawImage(img, x, y, size, size);
    return;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(size * 0.85)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText(unifiedToFallbackGlyph(unified), x + size / 2, y + size / 2);
  ctx.restore();
}
