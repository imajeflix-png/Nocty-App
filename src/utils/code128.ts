// ISO/IEC 15417 Code 128 (Code Set B) encoder + Canvas/SVG renderers
// Every value 0..106 maps to bar/space module widths (sum = 11 modules; Stop symbol 106 has 13 modules).
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B_CODE = 104;
const STOP_CODE = 106;
const QUIET_ZONE_MODULES = 10;

export function normalizeCode128Text(rawText: string, fallback = 'NOCTY.APP'): string {
  const ascii = rawText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (ascii || fallback).slice(0, 48);
}

export interface Code128Encoded {
  normalizedText: string;
  /** Array of bar segments (startModuleOffset, widthModules) */
  bars: Array<{ x: number; w: number }>;
  totalModules: number;
}

export function encodeCode128B(rawText: string): Code128Encoded {
  const text = normalizeCode128Text(rawText);
  const symbolValues: number[] = [START_B_CODE];
  let checksum = START_B_CODE;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const val = Math.max(0, Math.min(94, code - 32));
    symbolValues.push(val);
    checksum += val * (i + 1);
  }

  symbolValues.push(checksum % 103);
  symbolValues.push(STOP_CODE);

  const bars: Array<{ x: number; w: number }> = [];
  let cursor = QUIET_ZONE_MODULES;

  for (const symVal of symbolValues) {
    const pattern = CODE128_PATTERNS[symVal] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      const isBar = i % 2 === 0;
      if (isBar) {
        bars.push({ x: cursor, w });
      }
      cursor += w;
    }
  }

  return {
    normalizedText: text,
    bars,
    totalModules: cursor + QUIET_ZONE_MODULES,
  };
}

export function drawCode128ToCanvas(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  x: number,
  y: number,
  width: number,
  height: number,
  barColor = '#1A1A1A'
): Code128Encoded {
  const encoded = encodeCode128B(rawText);
  const scaleX = width / encoded.totalModules;

  ctx.save();
  ctx.fillStyle = barColor;
  for (const bar of encoded.bars) {
    const bx = Math.round(x + bar.x * scaleX);
    const bxEnd = Math.round(x + (bar.x + bar.w) * scaleX);
    const bw = Math.max(1, bxEnd - bx);
    ctx.fillRect(bx, y, bw, height);
  }
  ctx.restore();

  return encoded;
}
