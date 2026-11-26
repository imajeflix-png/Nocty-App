import { WeeklyAuraReport } from './weeklyAuraUtils';
import { drawAppleEmojiOnCanvas, loadAppleEmojiCanvasImage } from './appleEmojiCanvas';

export interface WeeklyAuraPosterResult {
  blob: Blob;
  dataUrl: string;
}

async function loadCorsSafeImage(src: string): Promise<HTMLImageElement | null> {
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
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderWeeklyAuraPosterPng(
  report: WeeklyAuraReport
): Promise<WeeklyAuraPosterResult> {
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  const { primary, secondary } = report.auraPalette;

  // 1. Deep Obsidian + Dynamic Aura Gradient Background
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, width, height);

  const glow1 = ctx.createRadialGradient(
    width * 0.2,
    height * 0.18,
    50,
    width * 0.2,
    height * 0.18,
    width * 0.95
  );
  glow1.addColorStop(0, `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.72)`);
  glow1.addColorStop(0.55, `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.18)`);
  glow1.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(
    width * 0.85,
    height * 0.72,
    40,
    width * 0.85,
    height * 0.72,
    width * 0.9
  );
  glow2.addColorStop(0, `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.65)`);
  glow2.addColorStop(0.55, `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.16)`);
  glow2.addColorStop(1, 'rgba(11, 11, 13, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(11, 11, 13, 0.28)');
  vignette.addColorStop(0.5, 'rgba(11, 11, 13, 0.15)');
  vignette.addColorStop(1, 'rgba(11, 11, 13, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 2. Top Eyebrow with Apple Sparkle Emoji & Aura Title
  const [sparkleImg, personaEmojiImg] = await Promise.all([
    loadAppleEmojiCanvasImage('2728'),
    loadAppleEmojiCanvasImage(report.personaUnified),
  ]);

  const eyebrowText = 'RAPORT MUSIK MINGGUAN • 7 HARI TERAKHIR';
  ctx.font = '600 26px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  const eyebrowW = ctx.measureText(eyebrowText).width;
  const ebEmojiSz = 28;
  const ebTotalW = ebEmojiSz + 12 + eyebrowW;
  const ebStartX = width / 2 - ebTotalW / 2;

  drawAppleEmojiOnCanvas(ctx, sparkleImg, '2728', ebStartX, 128, ebEmojiSz);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fillText(eyebrowText, ebStartX + ebEmojiSz + 12, 131);

  // Aura Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 72px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  const titleLines = wrapText(ctx, report.auraTitle, width - 150);
  let yCursor = 198;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, width / 2, yCursor);
    yCursor += 86;
  }

  // Aura Narrative
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = '400 30px "DM Sans", Inter, system-ui, sans-serif';
  const descLines = wrapText(ctx, report.auraNarrative, width - 170).slice(0, 4);
  yCursor += 18;
  for (const line of descLines) {
    ctx.fillText(line, width / 2, yCursor);
    yCursor += 44;
  }

  // 3. Stats Frosted Glass Row (Total Listening Time + Persona)
  const statsY = 580;
  const sidePad = 84;
  const gap = 28;
  const boxW = (width - sidePad * 2 - gap) / 2;
  const boxH = 220;

  const drawGlassCard = (x: number, y: number, w: number, h: number, radius = 36) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 14;
    drawRoundedRectPath(ctx, x, y, w, h, radius);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  // Left Stat Box: Total Waktu Dengar
  drawGlassCard(sidePad, statsY, boxW, boxH);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = '600 24px "DM Sans", Inter, system-ui, sans-serif';
  ctx.fillText('TOTAL WAKTU DENGAR', sidePad + 36, statsY + 36);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 44px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText(fitText(ctx, report.formattedTotalTime, boxW - 72), sidePad + 36, statsY + 86);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText(`${report.totalPlays} putaran lagu`, sidePad + 36, statsY + 154);

  // Right Stat Box: Pola Jam Aktif with Apple Emoji
  const rightBoxX = sidePad + boxW + gap;
  drawGlassCard(rightBoxX, statsY, boxW, boxH);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = '600 24px "DM Sans", Inter, system-ui, sans-serif';
  ctx.fillText('POLA JAM AKTIF', rightBoxX + 36, statsY + 36);

  drawAppleEmojiOnCanvas(ctx, personaEmojiImg, report.personaUnified, rightBoxX + 36, statsY + 88, 38);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 36px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText(fitText(ctx, report.personaLabel, boxW - 122), rightBoxX + 86, statsY + 89);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText(report.personaRange, rightBoxX + 36, statsY + 154);

  // 4. Top 3 Lagu Minggu Ini Glass Container
  const listY = 850;
  const listW = width - sidePad * 2;
  const listH = 820;
  drawGlassCard(sidePad, listY, listW, listH, 44);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 34px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText('Top Lagu Minggu Ini', sidePad + 44, listY + 42);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.font = '500 24px "DM Sans", Inter, system-ui, sans-serif';
  ctx.fillText(`${report.topArtists[0]?.artist || 'Nocty'}`, sidePad + listW - 44, listY + 48);

  const loadedCovers = await Promise.all(
    report.topTracks.map((t) => loadCorsSafeImage(t.artwork))
  );

  const rowStartY = listY + 126;
  const rowHeight = 205;
  const coverSize = 148;

  for (let i = 0; i < Math.min(3, report.topTracks.length); i++) {
    const track = report.topTracks[i];
    const rowY = rowStartY + i * rowHeight;
    const coverX = sidePad + 116;
    const coverY = rowY + 18;

    // Subtle divider between items
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sidePad + 44, rowY - 8);
      ctx.lineTo(sidePad + listW - 44, rowY - 8);
      ctx.stroke();
    }

    // Rank number
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '700 38px "JetBrains Mono", monospace';
    ctx.fillText(`0${i + 1}`, sidePad + 44, coverY + coverSize / 2);

    // 1:1 Cover Art
    const img = loadedCovers[i];
    ctx.save();
    drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 22);
    ctx.clip();
    if (img) {
      const ratio = img.width / img.height;
      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;
      if (ratio > 1) {
        sw = img.height;
        sx = (img.width - sw) / 2;
      } else if (ratio < 1) {
        sh = img.width;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, coverX, coverY, coverSize, coverSize);
    } else {
      const fb = ctx.createLinearGradient(coverX, coverY, coverX + coverSize, coverY + coverSize);
      fb.addColorStop(0, `rgb(${primary.r}, ${primary.g}, ${primary.b})`);
      fb.addColorStop(1, `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`);
      ctx.fillStyle = fb;
      ctx.fillRect(coverX, coverY, coverSize, coverSize);
    }
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 22);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Title, Artist, Play count
    const textX = coverX + coverSize + 34;
    const textMaxW = sidePad + listW - 44 - textX;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 34px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
    ctx.fillText(fitText(ctx, track.title, textMaxW), textX, coverY + 14);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.font = '500 26px "DM Sans", Inter, system-ui, sans-serif';
    ctx.fillText(fitText(ctx, track.artist, textMaxW), textX, coverY + 62);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 22px "JetBrains Mono", monospace';
    ctx.fillText(`${track.playCount}× diputar`, textX, coverY + 108);
  }

  // 5. Minimalist Bottom Watermark
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = '600 28px "Plus Jakarta Sans", Inter, system-ui, sans-serif';
  ctx.fillText('Nocty • Weekly Aura', width / 2, height - 120);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((out) => {
      if (out) resolve(out);
      else reject(new Error('Gagal membuat poster Weekly Aura.'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  return { blob, dataUrl };
}
