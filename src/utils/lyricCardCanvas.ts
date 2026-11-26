import { AmbientPalette, Track } from '../types/music';
import { drawAppleEmojiOnCanvas, loadAppleEmojiCanvasImage } from './appleEmojiCanvas';

interface LyricCardRenderOptions {
  track: Track;
  lines: string[];
  palette: AmbientPalette;
}

export interface LyricCardRenderResult {
  blob: Blob;
  dataUrl: string;
}

async function loadCorsSafeImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;

  const tryDirect = () =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const direct = await tryDirect();
  if (direct) return direct;

  try {
    const resp = await fetch(src, { mode: 'cors' });
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
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

function fitSingleLineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

export async function renderLyricCardPng({
  track,
  lines,
  palette,
}: LyricCardRenderOptions): Promise<LyricCardRenderResult> {
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia.');
  }

  const { primary, secondary } = palette;

  // 1. Deep Obsidian Base + Dynamic Ambient Dual-Color Mesh Gradient
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, width, height);

  const topGlow = ctx.createRadialGradient(
    width * 0.25,
    height * 0.22,
    40,
    width * 0.25,
    height * 0.22,
    width * 0.95
  );
  topGlow.addColorStop(0, `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.65)`);
  topGlow.addColorStop(0.55, `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.18)`);
  topGlow.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const bottomGlow = ctx.createRadialGradient(
    width * 0.78,
    height * 0.76,
    40,
    width * 0.78,
    height * 0.76,
    width * 0.95
  );
  bottomGlow.addColorStop(0, `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.58)`);
  bottomGlow.addColorStop(0.55, `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.16)`);
  bottomGlow.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, width, height);

  const centerAura = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    20,
    width * 0.5,
    height * 0.45,
    width * 0.7
  );
  centerAura.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  centerAura.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = centerAura;
  ctx.fillRect(0, 0, width, height);

  // Subtle dark vignette for high contrast text legibility
  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(11, 11, 13, 0.35)');
  vignette.addColorStop(0.5, 'rgba(11, 11, 13, 0.18)');
  vignette.addColorStop(1, 'rgba(11, 11, 13, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 2. Square 1:1 Album Artwork with Soft Shadow
  const coverSize = 420;
  const coverX = (width - coverSize) / 2;
  const coverY = 230;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 64;
  ctx.shadowOffsetY = 28;
  drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 42);
  ctx.fillStyle = '#18181D';
  ctx.fill();
  ctx.restore();

  const [coverImg, headphoneEmojiImg, sparkleEmojiImg] = await Promise.all([
    loadCorsSafeImage(track.coverUrl),
    loadAppleEmojiCanvasImage('1f3a7'),
    loadAppleEmojiCanvasImage('2728'),
  ]);

  ctx.save();
  drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 42);
  ctx.clip();

  if (coverImg) {
    // Center-crop square cover
    const imgRatio = coverImg.width / coverImg.height;
    let sx = 0;
    let sy = 0;
    let sw = coverImg.width;
    let sh = coverImg.height;
    if (imgRatio > 1) {
      sw = coverImg.height;
      sx = (coverImg.width - sw) / 2;
    } else if (imgRatio < 1) {
      sh = coverImg.width;
      sy = (coverImg.height - sh) / 2;
    }
    ctx.drawImage(coverImg, sx, sy, sw, sh, coverX, coverY, coverSize, coverSize);
  } else {
    const fallbackGrad = ctx.createLinearGradient(
      coverX,
      coverY,
      coverX + coverSize,
      coverY + coverSize
    );
    fallbackGrad.addColorStop(0, `rgb(${primary.r}, ${primary.g}, ${primary.b})`);
    fallbackGrad.addColorStop(1, `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`);
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(coverX, coverY, coverSize, coverSize);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 132px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      (track.title.trim()[0] || 'N').toUpperCase(),
      coverX + coverSize / 2,
      coverY + coverSize / 2
    );
  }
  ctx.restore();

  // Subtle glass border around album art
  ctx.save();
  drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 42);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 3. Track Title & Artist Name
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 48px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  const fittedTitle = fitSingleLineText(ctx, track.title, width - 160);
  ctx.fillText(fittedTitle, width / 2, coverY + coverSize + 48);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.font = '500 32px "DM Sans", Inter, system-ui, sans-serif';
  const fittedArtist = fitSingleLineText(ctx, track.artist, width - 180);
  ctx.fillText(fittedArtist, width / 2, coverY + coverSize + 114);

  // 4. Frosted Glass Lyric Quote Box (Apple Glassmorphism)
  const cardX = 96;
  const cardW = width - cardX * 2;
  const cardY = 860;
  const cardH = 740;

  // Soft outer drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 20;
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 48);
  const glassGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.11)');
  glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
  ctx.fillStyle = glassGrad;
  ctx.fill();
  ctx.restore();

  // Glass border + top specular highlight
  ctx.save();
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Subtle decorative quote mark at top-left of frosted box
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '700 84px Georgia, serif';
  ctx.fillText('“', cardX + 54, cardY + 34);
  ctx.restore();

  // Render 2-4 lyric lines inside frosted glass box with adaptive font sizing
  const cleanLines = (lines.length > 0 ? lines : [track.title]).slice(0, 4);
  const innerPadX = 68;
  const innerMaxW = cardW - innerPadX * 2;
  const innerMaxH = cardH - 150;

  let fontSize = cleanLines.length <= 2 ? 52 : cleanLines.length === 3 ? 46 : 41;
  let wrappedParagraphs: string[][] = [];
  let lineHeight = fontSize * 1.32;
  let paragraphGap = 24;

  while (fontSize >= 28) {
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;
    lineHeight = fontSize * 1.32;
    paragraphGap = Math.round(fontSize * 0.45);
    wrappedParagraphs = cleanLines.map((line) => wrapTextLines(ctx, line, innerMaxW));
    const totalLines = wrappedParagraphs.reduce((acc, grp) => acc + grp.length, 0);
    const totalHeight =
      totalLines * lineHeight + Math.max(0, wrappedParagraphs.length - 1) * paragraphGap;
    if (totalHeight <= innerMaxH) break;
    fontSize -= 3;
  }

  const totalLinesCount = wrappedParagraphs.reduce((acc, grp) => acc + grp.length, 0);
  const totalBlockH =
    totalLinesCount * lineHeight + Math.max(0, wrappedParagraphs.length - 1) * paragraphGap;

  let cursorY = cardY + (cardH - totalBlockH) / 2 + 12;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;

  for (let pIdx = 0; pIdx < wrappedParagraphs.length; pIdx++) {
    const grp = wrappedParagraphs[pIdx];
    for (const wrappedLine of grp) {
      ctx.fillText(wrappedLine, width / 2, cursorY);
      cursorY += lineHeight;
    }
    if (pIdx < wrappedParagraphs.length - 1) {
      cursorY += paragraphGap;
    }
  }

  // 5. Minimalist Bottom Watermark with Apple iOS Emoji
  ctx.save();
  const wmText = 'Nocty • Intimate Music';
  ctx.font = '600 26px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  const wmW = ctx.measureText(wmText).width;
  const emojiSz = 28;
  const totalWmW = emojiSz + 12 + wmW + 12 + emojiSz;
  const startWmX = width / 2 - totalWmW / 2;
  const wmY = height - 128;

  drawAppleEmojiOnCanvas(ctx, headphoneEmojiImg, '1f3a7', startWmX, wmY - emojiSz / 2, emojiSz);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.fillText(wmText, startWmX + emojiSz + 12, wmY);
  drawAppleEmojiOnCanvas(
    ctx,
    sparkleEmojiImg,
    '2728',
    startWmX + emojiSz + 12 + wmW + 12,
    wmY - emojiSz / 2,
    emojiSz
  );
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) resolve(out);
      else reject(new Error('Gagal membuat file gambar PNG.'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}
