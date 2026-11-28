import { Track } from '../types/music';
import { formatDuration } from './audioUtils';
import { drawAppleEmojiOnCanvas, loadAppleEmojiCanvasImage } from './appleEmojiCanvas';
import { drawCode128ToCanvas } from './code128';
import { SLIP_TEMPLATES, SlipTemplateId } from './slipTemplates';

export type ScribbleColor = '#D92D20' | '#175CD3' | '#141414';

export interface SlipPoint {
  x: number; // normalized 0..1 relative to 9:16 stage width
  y: number; // normalized 0..1 relative to 9:16 stage height
}

export interface SlipStroke {
  id: string;
  color: ScribbleColor;
  points: SlipPoint[];
  widthNorm: number; // normalized relative to stage width (e.g. 0.0065)
}

export interface SlipStickerOption {
  key: string;
  label: string;
  unified: string;
  fallbackSymbol: string;
}

export const SLIP_STICKER_OPTIONS: SlipStickerOption[] = [
  { key: 'star', label: 'Bintang', unified: '2b50', fallbackSymbol: '★' },
  { key: 'heart', label: 'Hati', unified: '2764-fe0f', fallbackSymbol: '♥' },
  { key: 'music', label: 'Nada', unified: '1f3b5', fallbackSymbol: '♪' },
  { key: 'fire', label: 'Api', unified: '1f525', fallbackSymbol: '🔥' },
  { key: 'sparkles', label: 'Kilau', unified: '2728', fallbackSymbol: '✨' },
  { key: 'cd', label: 'Vinyl', unified: '1f4bf', fallbackSymbol: '💿' },
  { key: 'coffee', label: 'Kopi', unified: '2615', fallbackSymbol: '☕' },
  { key: 'bolt', label: 'Kilat', unified: '26a1', fallbackSymbol: '⚡' },
];

export interface SlipPlacedSticker {
  id: string;
  unified: string;
  label: string;
  fallbackSymbol: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  rotationDeg: number;
  scale: number;
}

export interface SlipRenderParams {
  templateId: SlipTemplateId;
  tracks: Track[];
  orderCode: string;
  dateLabel: string;
  barcodePayload: string;
  serialCode: string;
  strokes: SlipStroke[];
  stickers: SlipPlacedSticker[];
  auraTitle?: string;
  auraSubtitle?: string;
  auraPrimaryRgb?: { r: number; g: number; b: number };
  auraSecondaryRgb?: { r: number; g: number; b: number };
}

export interface SlipRenderResult {
  blob: Blob;
  dataUrl: string;
}

export const SLIP_EXPORT_WIDTH = 1080;
export const SLIP_EXPORT_HEIGHT = 1920;

const RECEIPT_FONT_STACK = '"Courier Prime", "JetBrains Mono", ui-monospace, monospace';
const DISPLAY_FONT_STACK = '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
const SANS_FONT_STACK = '"DM Sans", Inter, system-ui, sans-serif';

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

function loadTemplateImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat template ${src}`));
    img.src = src;
  });
}

function fitTextWithEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

export function formatSlipDate(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
  const mm = months[date.getMonth()] || 'JAN';
  const yyyy = date.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}

async function renderNocturnalAuraBase(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: SlipRenderParams
): Promise<void> {
  const template = SLIP_TEMPLATES['nocturnal-aura'];
  const visibleTracks = params.tracks.slice(0, template.maxTracks);
  const totalSeconds = visibleTracks.reduce(
    (sum, t) => sum + Math.max(0, Math.round(t.duration || 0)),
    0
  );

  // 1. Deep Obsidian Dark Glassmorphism Backdrop with Mood-Matched Radial Aura Glow
  const p = params.auraPrimaryRgb ?? { r: 168, g: 85, b: 247 };
  const s = params.auraSecondaryRgb ?? { r: 244, g: 63, b: 94 };

  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, width, height);

  const primaryGlow = ctx.createRadialGradient(
    width * 0.22,
    height * 0.2,
    40,
    width * 0.22,
    height * 0.2,
    width * 0.92
  );
  primaryGlow.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 0.62)`);
  primaryGlow.addColorStop(0.5, `rgba(${p.r}, ${p.g}, ${p.b}, 0.22)`);
  primaryGlow.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = primaryGlow;
  ctx.fillRect(0, 0, width, height);

  const secondaryGlow = ctx.createRadialGradient(
    width * 0.82,
    height * 0.72,
    40,
    width * 0.82,
    height * 0.72,
    width * 0.88
  );
  secondaryGlow.addColorStop(0, `rgba(${s.r}, ${s.g}, ${s.b}, 0.54)`);
  secondaryGlow.addColorStop(0.52, `rgba(${s.r}, ${s.g}, ${s.b}, 0.18)`);
  secondaryGlow.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = secondaryGlow;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(11, 11, 13, 0.25)');
  vignette.addColorStop(0.5, 'rgba(11, 11, 13, 0.12)');
  vignette.addColorStop(1, 'rgba(11, 11, 13, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const drawGlassBox = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 16;
    drawRoundedRectPath(ctx, x, y, w, h, r);
    const fillGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    fillGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    fillGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtle specular top rim highlight
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1.5);
    ctx.lineTo(x + w - r, y + 1.5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  };

  // 2. Header Eyebrow & Aura Title ("Soft Hearted Dreamer")
  const sparkleImg = await loadAppleEmojiCanvasImage('2728');
  const eyebrowText = `NOCTURNAL AURA · ORDER #${params.orderCode}`;
  ctx.font = `600 24px ${DISPLAY_FONT_STACK}`;
  const eyebrowW = ctx.measureText(eyebrowText).width;
  const ebStartX = width / 2 - (28 + 12 + eyebrowW) / 2;

  drawAppleEmojiOnCanvas(ctx, sparkleImg, '2728', ebStartX, 128, 28);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
  ctx.fillText(eyebrowText, ebStartX + 40, 130);

  const auraTitle = (params.auraTitle || 'Soft Hearted Dreamer').trim();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 64px ${DISPLAY_FONT_STACK}`;
  ctx.fillText(fitTextWithEllipsis(ctx, auraTitle, width - 140), width / 2, 194);

  const auraSub =
    (params.auraSubtitle || `${params.dateLabel} · LATE NIGHT LISTENER`).toUpperCase();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.66)';
  ctx.font = `500 24px ${RECEIPT_FONT_STACK}`;
  ctx.fillText(fitTextWithEllipsis(ctx, auraSub, width - 160), width / 2, 286);

  // 3. Main Apple Liquid Glass Slip Card (Tracks + Durations)
  const sidePad = 84;
  const cardX = sidePad;
  const cardW = width - sidePad * 2;
  const cardY = 380;
  const cardH = 1040;
  drawGlassBox(cardX, cardY, cardW, cardH, 48);

  const innerLeft = cardX + 48;
  const innerRight = cardX + cardW - 48;
  const innerW = innerRight - innerLeft;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = `700 24px ${RECEIPT_FONT_STACK}`;
  ctx.fillText('NO   TRACK / ARTIST', innerLeft, cardY + 42);
  ctx.textAlign = 'right';
  ctx.fillText('TIME', innerRight, cardY + 42);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(innerLeft, cardY + 84);
  ctx.lineTo(innerRight, cardY + 84);
  ctx.stroke();
  ctx.restore();

  const rowsTop = cardY + 108;
  const summaryLineY = cardY + cardH - 102;
  const availableH = Math.max(120, summaryLineY - 14 - rowsTop);
  const count = Math.max(1, visibleTracks.length);
  const itemBlockH = 60; // 32px title + 2px gap + 24px artist
  const denseGap = Math.min(26, Math.max(12, Math.floor((availableH - count * itemBlockH) / Math.max(1, count))));
  const rowStep = itemBlockH + denseGap;

  if (visibleTracks.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = `600 28px ${SANS_FONT_STACK}`;
    ctx.fillText('BELUM ADA LAGU DIPILIH', width / 2, rowsTop + availableH / 2 - 16);
  } else {
    for (let i = 0; i < visibleTracks.length; i++) {
      const t = visibleTracks[i];
      const ry = rowsTop + i * rowStep;

      if (i > 0) {
        const divY = ry - Math.round(denseGap / 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(innerLeft, divY);
        ctx.lineTo(innerRight, divY);
        ctx.stroke();
      }

      // Track index
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 32px ${RECEIPT_FONT_STACK}`;
      ctx.fillText(String(i + 1).padStart(2, '0'), innerLeft, ry);

      // Duration
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.font = `700 26px ${RECEIPT_FONT_STACK}`;
      ctx.fillText(formatDuration(t.duration || 0), innerRight, ry + 3);

      // Title & Artist
      const textX = innerLeft + 58;
      const textMaxW = innerW - 58 - 108;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 32px ${DISPLAY_FONT_STACK}`;
      ctx.fillText(fitTextWithEllipsis(ctx, t.title.toUpperCase(), textMaxW), textX, ry);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
      ctx.font = `600 24px ${SANS_FONT_STACK}`;
      ctx.fillText(fitTextWithEllipsis(ctx, t.artist, textMaxW), textX, ry + 34);
    }
  }

  // Card bottom summary full-width dashed divider
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(innerLeft, summaryLineY);
  ctx.lineTo(innerRight, summaryLineY);
  ctx.stroke();
  ctx.restore();

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 25px ${RECEIPT_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(`ITEM COUNT: ${visibleTracks.length}`, innerLeft, summaryLineY + 26);
  ctx.textAlign = 'right';
  ctx.fillText(`TOTAL: ${formatDuration(totalSeconds)}`, innerRight, summaryLineY + 26);

  // 4. Crisp White Code 128 Barcode inside Dark Liquid Glass Dock at bottom (85% card width, 80px tall)
  const barcodeCardY = 1468;
  const barcodeCardH = 290;
  drawGlassBox(cardX, barcodeCardY, cardW, barcodeCardH, 42);

  const barcodeDrawW = Math.round(cardW * 0.85);
  const barcodeDrawH = template.barcodeHeightPx * 2;
  const barcodeDrawX = cardX + Math.round((cardW - barcodeDrawW) / 2);
  const barcodeDrawY = barcodeCardY + 62;
  drawCode128ToCanvas(
    ctx,
    params.barcodePayload,
    barcodeDrawX,
    barcodeDrawY,
    barcodeDrawW,
    barcodeDrawH,
    '#FFFFFF'
  );

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = `700 20px ${RECEIPT_FONT_STACK}`;
  ctx.fillText(params.serialCode, width / 2, barcodeDrawY + barcodeDrawH + 18);

  // Subtle Nocty watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = `600 24px ${DISPLAY_FONT_STACK}`;
  ctx.fillText('Nocty · Slip Nocty 9:16', width / 2, height - 108);
}

export async function renderSlipNoctyPng(params: SlipRenderParams): Promise<SlipRenderResult> {
  const {
    templateId,
    tracks,
    orderCode,
    dateLabel,
    barcodePayload,
    serialCode,
    strokes,
    stickers,
  } = params;
  const width = SLIP_EXPORT_WIDTH;
  const height = SLIP_EXPORT_HEIGHT;
  const template = SLIP_TEMPLATES[templateId];

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed even if font readiness check throws
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia.');
  }

  if (template.kind === 'glass-aura') {
    await renderNocturnalAuraBase(ctx, width, height, params);
  } else {
    // 1. Load & draw 9:16 WebP template artwork (cover fit)
    const bgImg = await loadTemplateImage(template.imageUrl || '/slip-templates/editorial-basket.webp');
    const imgRatio = bgImg.width / bgImg.height;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = bgImg.width;
    let sh = bgImg.height;
    if (imgRatio > targetRatio) {
      sw = bgImg.height * targetRatio;
      sx = (bgImg.width - sw) / 2;
    } else if (imgRatio < targetRatio) {
      sh = bgImg.width / targetRatio;
      sy = (bgImg.height - sh) / 2;
    }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, width, height);

    // 2. Render thermal receipt typography + Code 128 barcode inside exact Safe-Zone
    const { safeZone } = template;
    const zoneW = (safeZone.widthPct / 100) * width;
    const zoneH = (safeZone.heightPct / 100) * height;
    const zoneX = (safeZone.leftPct / 100) * width;
    const zoneY = (safeZone.topPct / 100) * height;

    const visibleTracks = tracks.slice(0, template.maxTracks);
    const totalSeconds = visibleTracks.reduce(
      (sum, t) => sum + Math.max(0, Math.round(t.duration || 0)),
      0
    );

    ctx.save();
    ctx.translate(zoneX + zoneW / 2, zoneY + zoneH / 2);
    ctx.rotate((safeZone.rotateDeg * Math.PI) / 180);
    ctx.translate(-zoneW / 2, -zoneH / 2);

    // Clip strictly inside Safe-Zone so text/barcode can never overflow paper bounds
    ctx.beginPath();
    ctx.rect(0, 0, zoneW, zoneH);
    ctx.clip();

    const padLeft = (safeZone.padXPx ?? 9) * 2;
    const padRight = (safeZone.padRightPx ?? safeZone.padXPx ?? 9) * 2;
    const padY = (safeZone.padYPx ?? 3) * 2;
    const innerW = zoneW - padLeft - padRight;
    const innerH = zoneH - padY * 2;
    const left = padLeft;
    const right = padLeft + innerW;

    ctx.textBaseline = 'top';

    const templateTypography =
      templateId === 'denim-patches'
        ? { meta: 24, header: 21, track: 28, artist: 22, duration: 24, footer: 24, serial: 20, gap: 10 }
        : templateId === 'editorial-basket'
          ? { meta: 25, header: 22, track: 30, artist: 23, duration: 25, footer: 25, serial: 20, gap: 13 }
          : { meta: 26, header: 23, track: 32, artist: 24, duration: 26, footer: 26, serial: 20, gap: 15 };

    const { meta: metaSize, header: headerSize, track: trackSize, artist: artistSize, duration: durationSize, footer: footerSize, serial: serialSize } =
      templateTypography;

    const drawInkText = (
      text: string,
      x: number,
      y: number,
      color: string,
      bleedAlpha = 0.24
    ) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = `rgba(17, 17, 17, ${bleedAlpha})`;
      ctx.shadowBlur = 1.8;
      ctx.shadowOffsetX = 0.4;
      ctx.shadowOffsetY = 0.4;
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    let cursorY = padY;

    // Order & Date row (24px–26px bold #111111)
    ctx.font = `800 ${metaSize}px ${RECEIPT_FONT_STACK}`;
    ctx.textAlign = 'left';
    drawInkText(`ORDER #${orderCode}`, left, cursorY, '#111111');
    ctx.textAlign = 'right';
    drawInkText(dateLabel, right, cursorY, '#111111');
    cursorY += Math.round(metaSize * 1.24);

    // Column headers: NO | TRACK / ARTIST | TIME
    const noColW = Math.round(trackSize * 1.62);
    const timeColW = Math.round(durationSize * 3.55);
    const trackColX = left + noColW;
    const trackColMaxW = innerW - noColW - timeColW - 10;

    ctx.font = `800 ${headerSize}px ${RECEIPT_FONT_STACK}`;
    ctx.textAlign = 'left';
    drawInkText('NO', left, cursorY, '#111111');
    drawInkText('TRACK / ARTIST', trackColX, cursorY, '#111111');
    ctx.textAlign = 'right';
    drawInkText('TIME', right, cursorY, '#111111');
    cursorY += Math.round(headerSize * 1.24);

    const drawDashedLine = (yPos: number) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.70)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(left, yPos);
      ctx.lineTo(right, yPos);
      ctx.stroke();
      ctx.restore();
    };

    drawDashedLine(cursorY);
    cursorY += 10;

    const barcodeHeight = template.barcodeHeightPx * 2; // 68px–80px at 1080x1920
    const footerLineGap = 8;
    const footerSummaryH = footerLineGap + Math.round(footerSize * 1.26) + 8;
    const barcodeBlockH = barcodeHeight + 6 + Math.round(serialSize * 1.15);
    const reservedBottomH = footerSummaryH + barcodeBlockH + 4;
    const availableRowsH = Math.max(70, padY + innerH - cursorY - reservedBottomH);
    const rowCount = Math.max(1, visibleTracks.length);

    const artistOffsetY = trackSize + 2; // tight 2px gap between title and artist
    const twoLineBlockH = artistOffsetY + artistSize;
    const maxStepForRows = availableRowsH / rowCount;
    const showTwoLineTrack = maxStepForRows >= twoLineBlockH + 2;
    const tightStep = showTwoLineTrack
      ? Math.min(twoLineBlockH + templateTypography.gap, maxStepForRows)
      : Math.min(trackSize + 10, maxStepForRows);

    if (visibleTracks.length === 0) {
      ctx.font = `600 ${trackSize}px ${RECEIPT_FONT_STACK}`;
      ctx.textAlign = 'center';
      drawInkText(
        'BELUM ADA LAGU DIPILIH',
        left + innerW / 2,
        cursorY + Math.max(12, availableRowsH / 2 - trackSize / 2),
        '#111111'
      );
    } else {
      for (let i = 0; i < visibleTracks.length; i++) {
        const t = visibleTracks[i];
        const rowY = cursorY + i * tightStep;

        // Track index ("01")
        ctx.font = `800 ${trackSize}px ${RECEIPT_FONT_STACK}`;
        ctx.textAlign = 'left';
        drawInkText(String(i + 1).padStart(2, '0'), left, rowY, '#111111');

        // Duration ("3:56")
        ctx.font = `800 ${durationSize}px ${RECEIPT_FONT_STACK}`;
        ctx.textAlign = 'right';
        drawInkText(formatDuration(t.duration || 0), right, rowY + Math.round((trackSize - durationSize) / 2), '#111111');

        ctx.textAlign = 'left';
        if (showTwoLineTrack) {
          ctx.font = `800 ${trackSize}px ${RECEIPT_FONT_STACK}`;
          drawInkText(
            fitTextWithEllipsis(ctx, t.title.toUpperCase(), trackColMaxW),
            trackColX,
            rowY,
            '#111111',
            0.26
          );

          ctx.font = `600 ${artistSize}px ${RECEIPT_FONT_STACK}`;
          drawInkText(
            fitTextWithEllipsis(ctx, t.artist, trackColMaxW),
            trackColX,
            rowY + artistOffsetY,
            '#333333',
            0.14
          );
        } else {
          ctx.font = `800 ${trackSize}px ${RECEIPT_FONT_STACK}`;
          const combined = `${t.title.toUpperCase()} - ${t.artist}`;
          drawInkText(fitTextWithEllipsis(ctx, combined, trackColMaxW), trackColX, rowY, '#111111');
        }
      }
    }

    const summaryStartY = padY + innerH - reservedBottomH;
    drawDashedLine(summaryStartY);

    const countTextY = summaryStartY + footerLineGap;
    ctx.font = `800 ${footerSize}px ${RECEIPT_FONT_STACK}`;
    ctx.textAlign = 'left';
    drawInkText(`ITEM COUNT: ${visibleTracks.length}`, left, countTextY, '#111111');
    ctx.textAlign = 'right';
    drawInkText(`TOTAL: ${formatDuration(totalSeconds)}`, right, countTextY, '#111111');

    const barcodeTopY = countTextY + Math.round(footerSize * 1.26) + 6;
    const barcodeMaxW = Math.round(innerW * 0.85);
    const barcodeX = left + Math.round((innerW - barcodeMaxW) / 2);

    drawCode128ToCanvas(
      ctx,
      barcodePayload,
      barcodeX,
      barcodeTopY,
      barcodeMaxW,
      barcodeHeight,
      '#111111'
    );

    ctx.font = `800 ${serialSize}px ${RECEIPT_FONT_STACK}`;
    ctx.textAlign = 'center';
    drawInkText(serialCode, left + innerW / 2, barcodeTopY + barcodeHeight + 6, '#111111', 0.16);

    ctx.restore();
  }

  // 3. Draw marker scribbles over the 9:16 stage
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(4, stroke.widthNorm * width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.9;

    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x * width, first.y * height);

    if (stroke.points.length === 1) {
      ctx.lineTo(first.x * width + 0.5, first.y * height + 0.5);
    } else {
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i];
        const next = stroke.points[i + 1];
        const midX = ((curr.x + next.x) / 2) * width;
        const midY = ((curr.y + next.y) / 2) * height;
        ctx.quadraticCurveTo(curr.x * width, curr.y * height, midX, midY);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x * width, last.y * height);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 4. Draw placed mini stickers
  if (stickers.length > 0) {
    const uniqueUnifieds = Array.from(new Set(stickers.map((s) => s.unified)));
    const loadedImgs = await Promise.all(uniqueUnifieds.map((u) => loadAppleEmojiCanvasImage(u)));
    const imgMap = new Map<string, HTMLImageElement | null>();
    uniqueUnifieds.forEach((u, idx) => imgMap.set(u, loadedImgs[idx]));

    for (const sticker of stickers) {
      const size = Math.round(78 * sticker.scale);
      const cx = sticker.x * width;
      const cy = sticker.y * height;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((sticker.rotationDeg * Math.PI) / 180);

      // Subtle tactile die-cut white sticker backing for authentic scrapbook sticker feel
      ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const emojiImg = imgMap.get(sticker.unified) ?? null;
      drawAppleEmojiOnCanvas(ctx, emojiImg, sticker.unified, -size / 2, -size / 2, size);
      ctx.restore();
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) resolve(out);
      else reject(new Error('Gagal membuat file gambar PNG Slip Nocty.'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}
