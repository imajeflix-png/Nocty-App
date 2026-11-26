import { AmbientPalette, Track } from '../types/music';
import { drawAppleEmojiOnCanvas, loadAppleEmojiCanvasImage } from './appleEmojiCanvas';

export type TwinBadge = 'Couple / LDR' | 'Late Night Bestie' | 'Just Friend';

export const TWIN_BADGE_META: Record<
  TwinBadge,
  { label: TwinBadge; unified: string; subtitle: string }
> = {
  'Couple / LDR': {
    label: 'Couple / LDR',
    unified: '2764-fe0f',
    subtitle: 'Satu frekuensi meski terpisah jarak',
  },
  'Late Night Bestie': {
    label: 'Late Night Bestie',
    unified: '1f319',
    subtitle: 'Teman begadang & kurasi musik malam',
  },
  'Just Friend': {
    label: 'Just Friend',
    unified: '1f609',
    subtitle: 'Dengerin bareng tanpa ekspektasi',
  },
};

export interface TwinReceiptPosterOptions {
  track: Track | null;
  partnerName: string;
  badge: TwinBadge;
  syncPercent: number;
  sessionMinutes: number;
  palette: AmbientPalette;
}

async function loadCorsSafeCover(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const direct = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

export async function renderTwinReceiptPosterPng({
  track,
  partnerName,
  badge,
  syncPercent,
  sessionMinutes,
  palette,
}: TwinReceiptPosterOptions): Promise<{ blob: Blob; dataUrl: string }> {
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  const { primary, secondary } = palette;
  const badgeUnified = TWIN_BADGE_META[badge].unified;

  const [coverImg, badgeEmojiImg, headphoneImg] = await Promise.all([
    track?.coverUrl ? loadCorsSafeCover(track.coverUrl) : Promise.resolve(null),
    loadAppleEmojiCanvasImage(badgeUnified),
    loadAppleEmojiCanvasImage('1f3a7'),
  ]);

  // 1. Deep Obsidian + Dual Ambient Backdrop
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, width, height);

  const g1 = ctx.createRadialGradient(
    width * 0.25,
    height * 0.2,
    40,
    width * 0.25,
    height * 0.2,
    width * 0.9
  );
  g1.addColorStop(0, `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.65)`);
  g1.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, width, height);

  const g2 = ctx.createRadialGradient(
    width * 0.8,
    height * 0.78,
    40,
    width * 0.8,
    height * 0.78,
    width * 0.9
  );
  g2.addColorStop(0, `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.58)`);
  g2.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);

  // 2. Frosted Glass Music Receipt Container
  const cardX = 92;
  const cardY = 175;
  const cardW = width - cardX * 2;
  const cardH = 1520;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 52;
  ctx.shadowOffsetY = 24;
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 48);
  const glass = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  glass.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  glass.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Receipt Header with Apple Headphone Emoji
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const headerTitle = 'NOCTY TWIN RECEIPT';
  ctx.font = '700 32px "JetBrains Mono", monospace';
  const headerTextW = ctx.measureText(headerTitle).width;
  const headerEmojiSize = 36;
  const headerTotalW = headerEmojiSize + 14 + headerTextW;
  const headerStartX = width / 2 - headerTotalW / 2;

  drawAppleEmojiOnCanvas(ctx, headphoneImg, '1f3a7', headerStartX, cardY + 62, headerEmojiSize);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(headerTitle, headerStartX + headerEmojiSize + 14, cardY + 80);

  // Badge Pill with Apple Emoji
  ctx.font = '600 28px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  const badgeTextW = ctx.measureText(badge).width;
  const badgeEmojiSize = 30;
  const pillW = badgeEmojiSize + 14 + badgeTextW + 56;
  const pillH = 62;
  const pillX = width / 2 - pillW / 2;
  const pillY = cardY + 132;

  drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 31);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawAppleEmojiOnCanvas(ctx, badgeEmojiImg, badgeUnified, pillX + 28, pillY + 16, badgeEmojiSize);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(badge, pillX + 28 + badgeEmojiSize + 14, pillY + pillH / 2 + 1);

  // Dashed Receipt Divider
  ctx.save();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 56, cardY + 236);
  ctx.lineTo(cardX + cardW - 56, cardY + 236);
  ctx.stroke();
  ctx.restore();

  // Album Cover 1:1
  const coverSize = 400;
  const coverX = (width - coverSize) / 2;
  const coverY = cardY + 285;

  ctx.save();
  drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 36);
  ctx.clip();
  if (coverImg) {
    const ratio = coverImg.width / coverImg.height;
    let sx = 0;
    let sy = 0;
    let sw = coverImg.width;
    let sh = coverImg.height;
    if (ratio > 1) {
      sw = coverImg.height;
      sx = (coverImg.width - sw) / 2;
    } else if (ratio < 1) {
      sh = coverImg.width;
      sy = (coverImg.height - sh) / 2;
    }
    ctx.drawImage(coverImg, sx, sy, sw, sh, coverX, coverY, coverSize, coverSize);
  } else {
    const fb = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
    fb.addColorStop(0, `rgb(${primary.r}, ${primary.g}, ${primary.b})`);
    fb.addColorStop(1, `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`);
    ctx.fillStyle = fb;
    ctx.fillRect(coverX, coverY, coverSize, coverSize);
  }
  ctx.restore();

  ctx.save();
  drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 36);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Track Info
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 44px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText(fitText(ctx, track?.title || 'Nocty Shared Session', cardW - 120), width / 2, coverY + coverSize + 44);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.font = '500 30px "DM Sans", Inter, system-ui, sans-serif';
  ctx.fillText(fitText(ctx, track?.artist || 'Nocty Music', cardW - 140), width / 2, coverY + coverSize + 106);

  // Dashed Receipt Divider 2
  const div2Y = coverY + coverSize + 185;
  ctx.save();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 56, div2Y);
  ctx.lineTo(cardX + cardW - 56, div2Y);
  ctx.stroke();
  ctx.restore();

  // Receipt Line Items
  const rows: Array<[string, string]> = [
    ['PENDENGAR', `Kamu & ${partnerName || 'Twin'}`],
    ['FREKUENSI VIBE', `${syncPercent}% Sinkron`],
    ['DURASI BERSAMA', `${sessionMinutes} Menit`],
    ['STATUS', 'Mendengarkan Bersama'],
  ];

  let ry = div2Y + 48;
  for (const [label, val] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.font = '500 26px "JetBrains Mono", monospace';
    ctx.fillText(label, cardX + 64, ry);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 28px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(fitText(ctx, val, cardW * 0.56), cardX + cardW - 64, ry - 2);
    ry += 78;
  }

  // Receipt Barcode / Footer
  const barY = cardY + cardH - 165;
  const barCount = 38;
  const barcodeW = cardW - 160;
  const barStartX = cardX + 80;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  for (let i = 0; i < barCount; i++) {
    const bx = barStartX + (i / barCount) * barcodeW;
    const bw = i % 3 === 0 ? 10 : i % 2 === 0 ? 6 : 4;
    ctx.fillRect(bx, barY, bw, 58);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = '600 26px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText('Nocty • Twin Music Receipt', width / 2, height - 115);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) resolve(out);
      else reject(new Error('Gagal membuat poster Nocty Twin Receipt.'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}
