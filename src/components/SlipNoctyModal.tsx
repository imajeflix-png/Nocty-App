import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Eraser,
  Loader2,
  PenTool,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Share2,
  Smile,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useSettings } from '../context/SettingsContext';
import { Track } from '../types/music';
import { detectTrackMood, formatDuration } from '../utils/audioUtils';
import { triggerHaptic } from '../utils/haptics';
import { analyzeWeeklyAura } from '../utils/weeklyAuraUtils';
import { encodeCode128B, normalizeCode128Text } from '../utils/code128';
import {
  SLIP_EXPORT_HEIGHT,
  SLIP_EXPORT_WIDTH,
  SLIP_STICKER_OPTIONS,
  ScribbleColor,
  SlipPlacedSticker,
  SlipPoint,
  SlipStickerOption,
  SlipStroke,
  formatSlipDate,
  renderSlipNoctyPng,
} from '../utils/slipCanvasRenderer';
import {
  SLIP_TEMPLATES,
  SLIP_TEMPLATE_LIST,
  SlipTemplateId,
  detectSlipTemplateForTrack,
} from '../utils/slipTemplates';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';

type TrackSourceMode = 'queue' | 'top' | 'manual';

const VIRTUAL_STAGE_W = 540;
const VIRTUAL_STAGE_H = 960;

const SCRIBBLE_COLORS: Array<{ id: ScribbleColor; label: string; swatchClass: string }> = [
  { id: '#D92D20', label: 'Spidol Merah', swatchClass: 'bg-[#D92D20]' },
  { id: '#175CD3', label: 'Spidol Biru', swatchClass: 'bg-[#175CD3]' },
  { id: '#141414', label: 'Spidol Hitam', swatchClass: 'bg-[#141414]' },
];

function generateOrderCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function buildSvgStrokePath(points: SlipPoint[], w: number, h: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const x = (points[0].x * w).toFixed(1);
    const y = (points[0].y * h).toFixed(1);
    return `M ${x} ${y} L ${(points[0].x * w + 0.4).toFixed(1)} ${(points[0].y * h + 0.4).toFixed(1)}`;
  }

  let d = `M ${(points[0].x * w).toFixed(1)} ${(points[0].y * h).toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (((curr.x + next.x) / 2) * w).toFixed(1);
    const midY = (((curr.y + next.y) / 2) * h).toFixed(1);
    d += ` Q ${(curr.x * w).toFixed(1)} ${(curr.y * h).toFixed(1)} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${(last.x * w).toFixed(1)} ${(last.y * h).toFixed(1)}`;
  return d;
}

export const SlipNoctyModal: React.FC = () => {
  const {
    isSlipModalOpen,
    setIsSlipModalOpen,
    currentTrack,
    queueTracks,
    likedTracks,
    localTracks,
    featuredTracks,
    indonesiaTrending,
    viralTracks,
    indieRnbTracks,
    trackRegistry,
    listeningHistory,
    ambientPalette,
    pushToast,
  } = usePlayer();
  const { settings } = useSettings();

  const [templateId, setTemplateId] = useState<SlipTemplateId>('editorial-basket');
  const [autoVibeReason, setAutoVibeReason] = useState<string>('Cocok untuk suasana saat ini');
  const [autoMatchedId, setAutoMatchedId] = useState<SlipTemplateId>('editorial-basket');

  const [sourceMode, setSourceMode] = useState<TrackSourceMode>('queue');
  const [manualTrackIds, setManualTrackIds] = useState<string[]>([]);
  const [manualSearch, setManualSearch] = useState('');

  const [orderCode, setOrderCode] = useState<string>(() => generateOrderCode());
  const [secretMessage, setSecretMessage] = useState<string>('');

  const [isScribbleActive, setIsScribbleActive] = useState<boolean>(false);
  const [scribbleColor, setScribbleColor] = useState<ScribbleColor>('#D92D20');
  const [strokes, setStrokes] = useState<SlipStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<SlipStroke | null>(null);

  const [stickers, setStickers] = useState<SlipPlacedSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const [stageScale, setStageScale] = useState<number>(300 / VIRTUAL_STAGE_W);
  const activeStrokeRef = useRef<SlipStroke | null>(null);
  const draggingStickerRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const todayDateLabel = useMemo(() => formatSlipDate(new Date()), []);
  const yearLabel = useMemo(() => String(new Date().getFullYear()), []);

  // Measure responsive 9:16 stage width to keep 1:1 fidelity with 1080x1920 PNG export
  useEffect(() => {
    if (!isSlipModalOpen) return;
    const el = stageWrapperRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setStageScale(rect.width / VIRTUAL_STAGE_W);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isSlipModalOpen]);

  const weeklyAura = useMemo(() => analyzeWeeklyAura(listeningHistory), [listeningHistory]);
  const nocturnalAuraTitle = weeklyAura.hasEnoughData
    ? weeklyAura.auraTitle
    : 'Soft Hearted Dreamer';
  const nocturnalAuraSubtitle = weeklyAura.hasEnoughData
    ? `${todayDateLabel} · ${weeklyAura.personaLabel}`
    : `${todayDateLabel} · LATE NIGHT LISTENER`;

  const nocturnalAuraColors = useMemo(() => {
    const mood = currentTrack ? detectTrackMood(currentTrack) : { mood: 'chill' as const };
    const isDefaultSlate =
      ambientPalette.primary.hex.toLowerCase() === '#94a3b8';
    if (!isDefaultSlate) {
      return {
        primary: {
          r: ambientPalette.primary.r,
          g: ambientPalette.primary.g,
          b: ambientPalette.primary.b,
        },
        secondary: {
          r: ambientPalette.secondary.r,
          g: ambientPalette.secondary.g,
          b: ambientPalette.secondary.b,
        },
      };
    }
    const moodPairs: Record<
      ReturnType<typeof detectTrackMood>['mood'],
      { primary: { r: number; g: number; b: number }; secondary: { r: number; g: number; b: number } }
    > = {
      upbeat: { primary: { r: 236, g: 72, b: 153 }, secondary: { r: 56, g: 189, b: 248 } },
      chill: { primary: { r: 168, g: 85, b: 247 }, secondary: { r: 244, g: 63, b: 94 } },
      focus: { primary: { r: 45, g: 212, b: 191 }, secondary: { r: 99, g: 102, b: 241 } },
      melancholic: { primary: { r: 139, g: 92, b: 246 }, secondary: { r: 225, g: 29, b: 72 } },
    };
    return moodPairs[mood.mood];
  }, [currentTrack, ambientPalette.primary, ambientPalette.secondary]);

  // Auto-Vibe template match & initial seed when opening modal
  useEffect(() => {
    if (!isSlipModalOpen) return;
    const vibe = detectSlipTemplateForTrack(currentTrack);
    if (settings.slipAutoVibeEnabled) {
      setTemplateId(vibe.templateId);
    }
    setAutoMatchedId(vibe.templateId);
    setAutoVibeReason(
      settings.slipAutoVibeEnabled ? vibe.reason : 'Auto-Vibe nonaktif di Pengaturan'
    );
    setOrderCode((prev) => prev || generateOrderCode());
    setIsScribbleActive(false);
    setSelectedStickerId(null);

    if (manualTrackIds.length === 0) {
      const initialIds: string[] = [];
      if (currentTrack) initialIds.push(currentTrack.id);
      for (const t of queueTracks) {
        if (!initialIds.includes(t.id) && initialIds.length < 6) {
          initialIds.push(t.id);
        }
      }
      if (initialIds.length === 0) {
        for (const t of featuredTracks.slice(0, 4)) {
          initialIds.push(t.id);
        }
      }
      setManualTrackIds(initialIds);
    }
  }, [isSlipModalOpen, currentTrack?.id, settings.slipAutoVibeEnabled]);

  // Escape key closes modal
  useEffect(() => {
    if (!isSlipModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSlipModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSlipModalOpen, setIsSlipModalOpen]);

  // Deduplicated catalog of all available tracks for manual picker
  const allCatalogTracks = useMemo<Track[]>(() => {
    const map = new Map<string, Track>();
    const append = (list: Track[]) => {
      for (const t of list) {
        if (t && !map.has(t.id)) map.set(t.id, t);
      }
    };
    if (currentTrack) append([currentTrack]);
    append(queueTracks);
    append(likedTracks);
    append(localTracks);
    append(featuredTracks);
    append(indonesiaTrending);
    append(viralTracks);
    append(indieRnbTracks);
    append(Object.values(trackRegistry));
    return Array.from(map.values());
  }, [
    currentTrack,
    queueTracks,
    likedTracks,
    localTracks,
    featuredTracks,
    indonesiaTrending,
    viralTracks,
    indieRnbTracks,
    trackRegistry,
  ]);

  // Top tracks built from listening history play count + fallback feeds
  const topHistoryTracks = useMemo<Track[]>(() => {
    const scoreMap = new Map<
      string,
      { count: number; seconds: number; metaTrack: Track | null }
    >();

    for (const entry of listeningHistory) {
      const existing = scoreMap.get(entry.trackId) || {
        count: 0,
        seconds: 0,
        metaTrack: trackRegistry[entry.trackId] || null,
      };
      existing.count += 1;
      existing.seconds += entry.durationListened || 0;
      if (!existing.metaTrack) {
        existing.metaTrack = {
          id: entry.trackId,
          title: entry.title,
          artist: entry.artist,
          duration: Math.max(120, Math.round(entry.durationListened || 185)),
          coverUrl: entry.artwork,
          sourceType: 'online',
          lyrics: [],
          createdAt: entry.timestamp,
        };
      }
      scoreMap.set(entry.trackId, existing);
    }

    const ranked = Array.from(scoreMap.values())
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds)
      .map((item) => item.metaTrack)
      .filter((t): t is Track => Boolean(t));

    const seen = new Set(ranked.map((t) => t.id));
    for (const fallback of [...likedTracks, ...featuredTracks, ...indonesiaTrending]) {
      if (ranked.length >= 6) break;
      if (!seen.has(fallback.id)) {
        seen.add(fallback.id);
        ranked.push(fallback);
      }
    }
    return ranked.slice(0, 6);
  }, [listeningHistory, trackRegistry, likedTracks, featuredTracks, indonesiaTrending]);

  // Queue-based track list (currentTrack first + upcoming tracks)
  const activeQueueReceiptTracks = useMemo<Track[]>(() => {
    const list: Track[] = [];
    const seen = new Set<string>();
    if (currentTrack) {
      list.push(currentTrack);
      seen.add(currentTrack.id);
    }
    for (const t of queueTracks) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        list.push(t);
      }
    }
    if (list.length === 0) {
      return featuredTracks.slice(0, 6);
    }
    return list.slice(0, 6);
  }, [currentTrack, queueTracks, featuredTracks]);

  const manualSelectedTracks = useMemo<Track[]>(() => {
    const lookup = new Map(allCatalogTracks.map((t) => [t.id, t]));
    return manualTrackIds
      .map((id) => lookup.get(id))
      .filter((t): t is Track => Boolean(t))
      .slice(0, 6);
  }, [allCatalogTracks, manualTrackIds]);

  const selectedTemplate = SLIP_TEMPLATES[templateId];

  const receiptTracks = useMemo<Track[]>(() => {
    const pool =
      sourceMode === 'queue'
        ? activeQueueReceiptTracks
        : sourceMode === 'top'
          ? topHistoryTracks
          : manualSelectedTracks;
    return pool.slice(0, selectedTemplate.maxTracks);
  }, [
    sourceMode,
    activeQueueReceiptTracks,
    topHistoryTracks,
    manualSelectedTracks,
    selectedTemplate.maxTracks,
  ]);

  const totalReceiptSeconds = useMemo(
    () => receiptTracks.reduce((acc, t) => acc + Math.max(0, Math.round(t.duration || 0)), 0),
    [receiptTracks]
  );

  const defaultShareUrl = `NOCTY.APP/S/${orderCode}`;
  const rawBarcodePayload = secretMessage.trim() || defaultShareUrl;
  const encodedBarcode = useMemo(() => encodeCode128B(rawBarcodePayload), [rawBarcodePayload]);
  const serialCode = `*NOCTY-${yearLabel}-${orderCode}*`;

  const filteredCatalog = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return allCatalogTracks.slice(0, 30);
    return allCatalogTracks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [allCatalogTracks, manualSearch]);

  const toggleManualTrack = (trackId: string) => {
    setManualTrackIds((prev) => {
      if (prev.includes(trackId)) {
        if (prev.length <= 1) {
          pushToast('Pilih minimal 1 lagu untuk Slip Nocty', 'info');
          return prev;
        }
        return prev.filter((id) => id !== trackId);
      }
      if (prev.length >= 6) {
        pushToast('Maksimal 6 lagu dipilih manual', 'info');
        return prev;
      }
      return [...prev, trackId];
    });
  };

  // Normalized pointer coordinate helper
  const getNormalizedPoint = useCallback((clientX: number, clientY: number): SlipPoint | null => {
    const el = stageWrapperRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(0.98, Math.max(0.02, (clientX - rect.left) / rect.width)),
      y: Math.min(0.98, Math.max(0.02, (clientY - rect.top) / rect.height)),
    };
  }, []);

  // Scribble drawing pointer handlers
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScribbleActive) {
      setSelectedStickerId(null);
      return;
    }
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: SlipStroke = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      color: scribbleColor,
      points: [pt],
      widthNorm: 0.0065,
    };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingStickerRef.current) {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      if (!pt) return;
      const { id, offsetX, offsetY } = draggingStickerRef.current;
      const nx = Math.min(0.92, Math.max(0.08, pt.x - offsetX));
      const ny = Math.min(0.94, Math.max(0.06, pt.y - offsetY));
      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, x: nx, y: ny } : s))
      );
      return;
    }

    if (!isScribbleActive || !activeStrokeRef.current) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    const lastPt = activeStrokeRef.current.points[activeStrokeRef.current.points.length - 1];
    const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
    if (dist < 0.003) return;

    const updated: SlipStroke = {
      ...activeStrokeRef.current,
      points: [...activeStrokeRef.current.points, pt],
    };
    activeStrokeRef.current = updated;
    setActiveStroke(updated);
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingStickerRef.current) {
      draggingStickerRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }
    if (activeStrokeRef.current) {
      const finalized = activeStrokeRef.current;
      activeStrokeRef.current = null;
      setActiveStroke(null);
      setStrokes((prev) => [...prev, finalized]);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleStickerPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    sticker: SlipPlacedSticker
  ) => {
    if (isScribbleActive) return;
    e.stopPropagation();
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;
    setSelectedStickerId(sticker.id);
    draggingStickerRef.current = {
      id: sticker.id,
      offsetX: pt.x - sticker.x,
      offsetY: pt.y - sticker.y,
    };
    stageWrapperRef.current?.setPointerCapture(e.pointerId);
  };

  const handleAddSticker = (opt: SlipStickerOption) => {
    const idx = stickers.length;
    const { safeZone } = selectedTemplate;
    // Place neatly inside or around paper corners with gentle scatter
    const baseX = (safeZone.leftPct + safeZone.widthPct * 0.82) / 100;
    const baseY = (safeZone.topPct + safeZone.heightPct * 0.22) / 100;
    const offsetX = ((idx % 3) - 1) * 0.08;
    const offsetY = (Math.floor(idx / 3) % 3) * 0.09;

    const placed: SlipPlacedSticker = {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      unified: opt.unified,
      label: opt.label,
      fallbackSymbol: opt.fallbackSymbol,
      x: Math.min(0.86, Math.max(0.14, baseX + offsetX)),
      y: Math.min(0.86, Math.max(0.16, baseY + offsetY)),
      rotationDeg: ((idx % 2 === 0 ? -1 : 1) * (5 + (idx % 4) * 4)),
      scale: 1,
    };
    setStickers((prev) => [...prev, placed]);
    setSelectedStickerId(placed.id);
    setIsScribbleActive(false);
  };

  const handleRemoveSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const buildExportImage = async () => {
    return renderSlipNoctyPng({
      templateId,
      tracks: receiptTracks,
      orderCode,
      dateLabel: todayDateLabel,
      barcodePayload: rawBarcodePayload,
      serialCode,
      strokes,
      stickers,
      auraTitle: nocturnalAuraTitle,
      auraSubtitle: nocturnalAuraSubtitle,
      auraPrimaryRgb: nocturnalAuraColors.primary,
      auraSecondaryRgb: nocturnalAuraColors.secondary,
    });
  };

  const handleSaveSlipPng = async () => {
    if (isExporting) return;
    triggerHaptic(12);
    setIsExporting(true);
    try {
      const { blob, dataUrl } = await buildExportImage();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url || dataUrl;
      a.download = `nocty-slip-${orderCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1800);
      pushToast('Slip Nocty 9:16 HD berhasil disimpan', 'success');
    } catch {
      pushToast('Gagal mengekspor gambar Slip Nocty', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareSlipStory = async () => {
    if (isExporting) return;
    triggerHaptic(12);
    setIsExporting(true);
    try {
      const { blob } = await buildExportImage();
      const file = new File([blob], `nocty-slip-${orderCode}.png`, {
        type: 'image/png',
      });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `Slip Nocty #${orderCode}`,
            text: 'Struk musik pilihan dari Nocty',
          });
          return;
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nocty-slip-${orderCode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1800);
      pushToast('Gambar 9:16 siap diunggah ke IG Story / TikTok', 'info');
    } catch {
      pushToast('Gagal membagikan Slip Nocty', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isSlipModalOpen) return null;

  // Scaled geometry matching export 1080x1920 at exact 0.5x virtual coordinates (540x960)
  const { safeZone } = selectedTemplate;
  const virtualTypography =
    templateId === 'denim-patches'
      ? { meta: 12, header: 10.5, track: 14, artist: 11, duration: 12, footer: 12, serial: 10, gap: 5 }
      : templateId === 'editorial-basket'
        ? { meta: 12.5, header: 11, track: 15, artist: 11.5, duration: 12.5, footer: 12.5, serial: 10, gap: 6.5 }
        : { meta: 13, header: 11.5, track: 16, artist: 12, duration: 13, footer: 13, serial: 10, gap: 7.5 };

  const metaSizePx = virtualTypography.meta;
  const headerSizePx = virtualTypography.header;
  const trackSizePx = virtualTypography.track;
  const artistSizePx = virtualTypography.artist;
  const durationSizePx = virtualTypography.duration;
  const footerSizePx = virtualTypography.footer;
  const serialSizePx = virtualTypography.serial;
  const trackRowGapPx = virtualTypography.gap;
  const barcodeHeightPx = selectedTemplate.barcodeHeightPx;
  const padLeftPx = safeZone.padXPx ?? 9;
  const padRightPx = safeZone.padRightPx ?? safeZone.padXPx ?? 9;
  const padYPx = safeZone.padYPx ?? 3;
  const noColWPx = Math.round(trackSizePx * 1.62);
  const timeColWPx = Math.round(durationSizePx * 3.55);

  const zoneWVirtual = (safeZone.widthPct / 100) * VIRTUAL_STAGE_W;
  const zoneInnerWVirtual = zoneWVirtual - padLeftPx - padRightPx;
  const zoneHVirtual = (safeZone.heightPct / 100) * VIRTUAL_STAGE_H;
  const topHeaderVirtualH = metaSizePx * 1.24 + headerSizePx * 1.24 + 7;
  const bottomReservedVirtualH = 6 + footerSizePx * 1.26 + 7 + barcodeHeightPx + 3 + serialSizePx * 1.15 + 2;
  const availableRowsVirtual = Math.max(
    35,
    zoneHVirtual - padYPx * 2 - topHeaderVirtualH - bottomReservedVirtualH
  );
  const showTwoLineTrack =
    availableRowsVirtual / Math.max(1, receiptTracks.length) >= trackSizePx + artistSizePx + 2;

  const allStrokesToRender = activeStroke ? [...strokes, activeStroke] : strokes;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Slip Nocty — Struk Musik 9:16"
      className="fixed inset-0 z-[74] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => setIsSlipModalOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-5xl h-[94dvh] sm:h-auto sm:max-h-[92vh] flex flex-col rounded-t-[26px] sm:rounded-3xl bg-[#121216]/95 backdrop-blur-md border border-white/[0.12] shadow-2xl overflow-hidden">
        {/* Clean Header */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/[0.12] flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-white" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                Slip Nocty
              </h2>
              <p className="text-xs text-white/60 truncate">
                Struk musik 9:16 siap IG Story &amp; TikTok · {autoVibeReason}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSlipModalOpen(false)}
            aria-label="Tutup Slip Nocty"
            className="min-w-[38px] min-h-[38px] rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </header>

        {/* Main Workspace: Top Preview (max-h-[52vh] on mobile) + Smooth Scrollable Controls */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[360px_1fr] overflow-hidden">
          {/* PREVIEW STAGE */}
          <div className="shrink-0 flex flex-col items-center justify-center px-4 py-3 lg:p-5 border-b border-white/[0.08] lg:border-b-0 lg:border-r lg:border-white/[0.08] bg-black/20">
            <div
              ref={stageWrapperRef}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerCancel={handleStagePointerUp}
              className={`on-artwork relative h-[42vh] sm:h-[46vh] max-h-[52vh] w-auto aspect-[9/16] lg:h-auto lg:max-h-[66vh] lg:w-full lg:max-w-[320px] rounded-2xl overflow-hidden bg-[#18181D] border border-white/[0.14] shadow-[0_20px_50px_rgba(0,0,0,0.65)] select-none ${
                isScribbleActive ? 'cursor-crosshair touch-none' : ''
              }`}
            >
              {/* Exact 540x960 scaled coordinate stage */}
              <div
                style={{
                  width: VIRTUAL_STAGE_W,
                  height: VIRTUAL_STAGE_H,
                  transform: `scale(${stageScale})`,
                  transformOrigin: 'top left',
                }}
                className="relative overflow-hidden"
              >
                {selectedTemplate.kind === 'glass-aura' ? (
                  <div className="absolute inset-0 bg-[#0B0B0D] overflow-hidden pointer-events-none flex flex-col justify-between px-[42px] pt-[64px] pb-[54px]">
                    {/* Mood-Matched Radial Aura Glow */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0"
                      style={{
                        background: `
                          radial-gradient(circle at 22% 20%, rgba(${nocturnalAuraColors.primary.r}, ${nocturnalAuraColors.primary.g}, ${nocturnalAuraColors.primary.b}, 0.56) 0%, rgba(${nocturnalAuraColors.primary.r}, ${nocturnalAuraColors.primary.g}, ${nocturnalAuraColors.primary.b}, 0.18) 44%, transparent 72%),
                          radial-gradient(circle at 82% 72%, rgba(${nocturnalAuraColors.secondary.r}, ${nocturnalAuraColors.secondary.g}, ${nocturnalAuraColors.secondary.b}, 0.48) 0%, rgba(${nocturnalAuraColors.secondary.r}, ${nocturnalAuraColors.secondary.g}, ${nocturnalAuraColors.secondary.b}, 0.16) 46%, transparent 72%)
                        `,
                      }}
                    />

                    {/* Top Eyebrow + Soft Hearted Dreamer Title */}
                    <div className="relative z-10 text-center space-y-2.5">
                      <div className="inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold tracking-wider text-white/75">
                        <AppleEmoji unified="2728" size={14} />
                        <span>NOCTURNAL AURA · ORDER #{orderCode}</span>
                      </div>
                      <h3 className="font-display text-[32px] font-extrabold tracking-tight text-white leading-tight truncate">
                        {nocturnalAuraTitle}
                      </h3>
                      <p
                        style={{ fontFamily: '"Courier Prime", "JetBrains Mono", monospace' }}
                        className="text-[12px] font-medium tracking-wide text-white/65 uppercase truncate"
                      >
                        {nocturnalAuraSubtitle}
                      </p>
                    </div>

                    {/* Middle Apple Liquid Glass Card (Tracks + Durations) */}
                    <div className="relative z-10 h-[520px] rounded-[24px] bg-gradient-to-br from-white/[0.12] to-white/[0.05] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28),0_16px_38px_rgba(0,0,0,0.45)] px-[24px] py-[21px] flex flex-col justify-between overflow-hidden">
                      <div className="shrink-0">
                        <div
                          style={{ fontFamily: '"Courier Prime", "JetBrains Mono", monospace' }}
                          className="flex items-center justify-between text-[12px] font-bold text-white/90 pb-2"
                        >
                          <span>NO &nbsp; TRACK / ARTIST</span>
                          <span>TIME</span>
                        </div>
                        <div className="w-full border-b-2 border-dashed border-white/45" />
                      </div>

                      <div className="flex-1 min-h-0 flex flex-col justify-start gap-2.5 pt-2.5 pb-1 divide-y divide-white/[0.10] overflow-hidden">
                        {receiptTracks.length === 0 ? (
                          <p className="text-center text-sm font-semibold text-white/65 my-auto">
                            BELUM ADA LAGU DIPILIH
                          </p>
                        ) : (
                          receiptTracks.map((t, idx) => (
                            <div
                              key={`${t.id}-${idx}`}
                              className="flex items-start gap-2.5 pt-2 first:pt-0 min-w-0"
                            >
                              <span
                                style={{
                                  fontFamily: '"Courier Prime", "JetBrains Mono", monospace',
                                }}
                                className="w-6 text-[16px] font-extrabold text-white tabular-nums shrink-0 leading-none"
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-display text-[16px] font-extrabold text-white uppercase truncate leading-none">
                                  {t.title}
                                </p>
                                <p className="text-[12px] font-semibold text-white/75 truncate mt-[1px] leading-tight">
                                  {t.artist}
                                </p>
                              </div>
                              <span
                                style={{
                                  fontFamily: '"Courier Prime", "JetBrains Mono", monospace',
                                }}
                                className="text-[13px] font-bold text-white/95 tabular-nums text-right shrink-0 leading-tight"
                              >
                                {formatDuration(t.duration || 0)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="shrink-0">
                        <div className="w-full border-b-2 border-dashed border-white/45 mb-2.5" />
                        <div
                          style={{ fontFamily: '"Courier Prime", "JetBrains Mono", monospace' }}
                          className="flex items-center justify-between text-[12.5px] font-bold text-white tabular-nums"
                        >
                          <span>ITEM COUNT: {receiptTracks.length}</span>
                          <span>TOTAL: {formatDuration(totalReceiptSeconds)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Crisp White Code 128 Barcode inside Dark Liquid Glass Dock */}
                    <div className="relative z-10 space-y-2.5">
                      <div className="rounded-[21px] bg-gradient-to-br from-white/[0.12] to-white/[0.05] backdrop-blur-xl border border-white/[0.18] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28),0_14px_32px_rgba(0,0,0,0.4)] px-[28px] py-[22px] flex flex-col items-center gap-3">
                        <svg
                          viewBox={`0 0 ${encodedBarcode.totalModules} ${barcodeHeightPx}`}
                          preserveAspectRatio="none"
                          style={{ width: '85%', height: barcodeHeightPx }}
                          aria-label={`Barcode Code 128 berisi ${encodedBarcode.normalizedText}`}
                          shapeRendering="crispEdges"
                        >
                          {encodedBarcode.bars.map((bar, idx) => (
                            <rect
                              key={idx}
                              x={bar.x}
                              y={0}
                              width={bar.w}
                              height={barcodeHeightPx}
                              fill="#FFFFFF"
                            />
                          ))}
                        </svg>
                        <p
                          style={{ fontFamily: '"Courier Prime", "JetBrains Mono", monospace' }}
                          className="text-[10px] font-bold tracking-wider text-white/90 text-center"
                        >
                          {serialCode}
                        </p>
                      </div>

                      <p className="text-center font-display text-[12px] font-semibold text-white/50">
                        Nocty · Slip Nocty 9:16
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* WebP Template Graphic */}
                    <img
                      src={selectedTemplate.imageUrl}
                      alt={selectedTemplate.name}
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />

                    {/* Calibrated Receipt Safe-Zone Overlay */}
                    <div
                      style={{
                        top: `${safeZone.topPct}%`,
                        left: `${safeZone.leftPct}%`,
                        width: `${safeZone.widthPct}%`,
                        height: `${safeZone.heightPct}%`,
                        transform: `rotate(${safeZone.rotateDeg}deg)`,
                        paddingLeft: padLeftPx,
                        paddingRight: padRightPx,
                        paddingTop: padYPx,
                        paddingBottom: padYPx,
                        fontFamily: '"Courier Prime", "JetBrains Mono", monospace',
                        color: '#111111',
                        textShadow: '0 0 0.65px rgba(17, 17, 17, 0.32)',
                      }}
                      className="absolute flex flex-col justify-between overflow-hidden pointer-events-none"
                    >
                      {/* Top Group: ORDER # & Daftar Lagu */}
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <div className="shrink-0">
                          <div
                            style={{ fontSize: metaSizePx, lineHeight: 1.24 }}
                            className="flex items-center justify-between font-extrabold tracking-tight"
                          >
                            <span>ORDER #{orderCode}</span>
                            <span>{todayDateLabel}</span>
                          </div>

                          <div
                            style={{ fontSize: headerSizePx, lineHeight: 1.24 }}
                            className="mt-[1px] flex items-center font-extrabold"
                          >
                            <span style={{ width: noColWPx }} className="shrink-0">
                              NO
                            </span>
                            <span className="flex-1 min-w-0 truncate">TRACK / ARTIST</span>
                            <span style={{ width: timeColWPx }} className="text-right shrink-0">
                              TIME
                            </span>
                          </div>

                          <div className="my-1 w-full border-b-2 border-dashed border-[#1A1A1A]/70" />
                        </div>

                        {/* Dense Thermal Receipt Track List */}
                        <div
                          style={{ gap: `${trackRowGapPx}px` }}
                          className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden pt-0.5"
                        >
                          {receiptTracks.length === 0 ? (
                            <p
                              style={{ fontSize: trackSizePx }}
                              className="text-center font-semibold opacity-75 my-auto"
                            >
                              BELUM ADA LAGU DIPILIH
                            </p>
                          ) : (
                            receiptTracks.map((t, idx) => (
                              <div
                                key={`${t.id}-${idx}`}
                                className="flex items-start gap-0 min-w-0"
                              >
                                <span
                                  style={{ fontSize: trackSizePx, width: noColWPx, lineHeight: 1.05 }}
                                  className="font-extrabold shrink-0 tabular-nums"
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <div className="flex-1 min-w-0 pr-1">
                                  {showTwoLineTrack ? (
                                    <>
                                      <p
                                        style={{
                                          fontSize: trackSizePx,
                                          lineHeight: 1.05,
                                          fontWeight: 800,
                                          color: '#111111',
                                        }}
                                        className="truncate uppercase"
                                      >
                                        {t.title}
                                      </p>
                                      <p
                                        style={{
                                          fontSize: artistSizePx,
                                          lineHeight: 1.1,
                                          fontWeight: 600,
                                          color: '#333333',
                                          marginTop: '1px',
                                          textShadow: '0 0 0.45px rgba(17, 17, 17, 0.2)',
                                        }}
                                        className="truncate"
                                      >
                                        {t.artist}
                                      </p>
                                    </>
                                  ) : (
                                    <p
                                      style={{
                                        fontSize: trackSizePx,
                                        lineHeight: 1.1,
                                        fontWeight: 800,
                                        color: '#111111',
                                      }}
                                      className="truncate uppercase"
                                    >
                                      {t.title} - {t.artist}
                                    </p>
                                  )}
                                </div>
                                <span
                                  style={{
                                    fontSize: durationSizePx,
                                    width: timeColWPx,
                                    lineHeight: 1.1,
                                  }}
                                  className="text-right font-extrabold shrink-0 tabular-nums"
                                >
                                  {formatDuration(t.duration || 0)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Bottom Locked Group: TOTAL + Full-Width Dashed Line + Tall Code 128 Barcode */}
                      <div className="shrink-0 pt-0.5">
                        <div className="mb-1 w-full border-b-2 border-dashed border-[#1A1A1A]/70" />
                        <div
                          style={{ fontSize: footerSizePx, lineHeight: 1.24 }}
                          className="flex items-center justify-between font-extrabold tabular-nums mb-1"
                        >
                          <span>ITEM COUNT: {receiptTracks.length}</span>
                          <span>TOTAL: {formatDuration(totalReceiptSeconds)}</span>
                        </div>

                        {/* Real 1D Code 128 SVG Barcode (85% paper width, 68px–80px at export) */}
                        <div className="flex flex-col items-center">
                          <svg
                            viewBox={`0 0 ${encodedBarcode.totalModules} ${barcodeHeightPx}`}
                            preserveAspectRatio="none"
                            style={{
                              width: Math.round(zoneInnerWVirtual * 0.85),
                              height: barcodeHeightPx,
                            }}
                            aria-label={`Barcode Code 128 berisi ${encodedBarcode.normalizedText}`}
                            shapeRendering="crispEdges"
                          >
                            {encodedBarcode.bars.map((bar, idx) => (
                              <rect
                                key={idx}
                                x={bar.x}
                                y={0}
                                width={bar.w}
                                height={barcodeHeightPx}
                                fill="#111111"
                              />
                            ))}
                          </svg>
                          <p
                            style={{ fontSize: serialSizePx, lineHeight: 1.15 }}
                            className="mt-0.5 font-extrabold tracking-wider text-center text-[#111111]"
                          >
                            {serialCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Scribble Ink SVG Layer */}
                <svg
                  viewBox={`0 0 ${VIRTUAL_STAGE_W} ${VIRTUAL_STAGE_H}`}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {allStrokesToRender.map((stroke) => (
                    <path
                      key={stroke.id}
                      d={buildSvgStrokePath(stroke.points, VIRTUAL_STAGE_W, VIRTUAL_STAGE_H)}
                      fill="none"
                      stroke={stroke.color}
                      strokeWidth={Math.max(2, stroke.widthNorm * VIRTUAL_STAGE_W)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity={0.9}
                    />
                  ))}
                </svg>

                {/* Placed Interactive Mini Stickers */}
                {stickers.map((sticker) => {
                  const isSelected = selectedStickerId === sticker.id;
                  return (
                    <div
                      key={sticker.id}
                      onPointerDown={(e) => handleStickerPointerDown(e, sticker)}
                      style={{
                        left: `${sticker.x * 100}%`,
                        top: `${sticker.y * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${sticker.rotationDeg}deg) scale(${sticker.scale})`,
                      }}
                      className={`group absolute touch-none ${
                        isScribbleActive ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <div
                        className={`relative w-[46px] h-[46px] rounded-full bg-white shadow-[0_3px_10px_rgba(0,0,0,0.3)] flex items-center justify-center ${
                          isSelected ? 'ring-2 ring-amber-400' : ''
                        }`}
                      >
                        <AppleEmoji unified={sticker.unified} size={36} alt={sticker.label} />
                        {!isScribbleActive && (
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSticker(sticker.id);
                            }}
                            aria-label={`Hapus stiker ${sticker.label}`}
                            className={`absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0B0B0D] text-white border border-white/25 flex items-center justify-center transition-opacity ${
                              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <X className="w-3 h-3" strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Scribble mode subtle helper badge inside stage edge */}
              {isScribbleActive && (
                <div className="pointer-events-none absolute top-2 left-2 right-2 px-2 py-1 rounded-lg bg-black/75 text-white text-[10px] font-medium text-center">
                  Spidol Aktif — coret di atas struk
                </div>
              )}
            </div>
          </div>

          {/* SCROLLABLE CONTROLS PANEL */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* 0. Pilihan 4 Template */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Pilihan Template ({selectedTemplate.maxTracks} lagu maks.)
                </h3>
                {templateId === autoMatchedId && settings.slipAutoVibeEnabled && (
                  <span className="text-[11px] font-medium text-emerald-300">
                    Rekomendasi Vibe
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SLIP_TEMPLATE_LIST.map((tpl) => {
                  const active = tpl.id === templateId;
                  const isRecommended = tpl.id === autoMatchedId && settings.slipAutoVibeEnabled;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateId(tpl.id)}
                      className={`on-artwork group relative rounded-xl overflow-hidden border text-left transition-all ${
                        active
                          ? 'border-white ring-1 ring-white/60 bg-white/10'
                          : 'border-white/[0.10] bg-white/[0.04] hover:border-white/25'
                      }`}
                    >
                      <div className="relative aspect-[9/12] w-full overflow-hidden bg-[#0B0B0D]">
                        {tpl.kind === 'glass-aura' ? (
                          <div
                            className="w-full h-full relative flex flex-col items-center justify-center p-1.5"
                            style={{
                              background: `
                                radial-gradient(circle at 25% 25%, rgba(${nocturnalAuraColors.primary.r}, ${nocturnalAuraColors.primary.g}, ${nocturnalAuraColors.primary.b}, 0.72) 0%, transparent 65%),
                                radial-gradient(circle at 80% 75%, rgba(${nocturnalAuraColors.secondary.r}, ${nocturnalAuraColors.secondary.g}, ${nocturnalAuraColors.secondary.b}, 0.65) 0%, transparent 65%),
                                #0B0B0D
                              `,
                            }}
                          >
                            <div className="w-full h-[56%] rounded-lg bg-white/[0.12] border border-white/[0.22] backdrop-blur-md p-1.5 flex flex-col justify-between">
                              <span className="h-1 w-2/3 rounded-full bg-white/75" />
                              <span className="h-1 w-full rounded-full bg-white/40" />
                              <span className="h-1 w-4/5 rounded-full bg-white/40" />
                              <span className="h-1.5 w-full rounded bg-white/85" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={tpl.imageUrl}
                            alt={tpl.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                        {isRecommended && (
                          <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/75 text-[8px] font-semibold text-white">
                            Auto
                          </span>
                        )}
                        {active && (
                          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                          </span>
                        )}
                        <div className="absolute inset-x-1.5 bottom-1">
                          <p className="text-[10px] font-semibold text-white truncate leading-tight">
                            {tpl.name}
                          </p>
                          <p className="text-[8px] text-white/70 truncate leading-tight">
                            {tpl.subtitle}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="border-t border-white/[0.08]" />

            {/* 1. Sumber Lagu Segmented Control */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Sumber Daftar Lagu</h3>
                  <span className="font-mono-tabular text-xs text-white/55">
                    Menampilkan {receiptTracks.length}/{selectedTemplate.maxTracks} lagu
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.06] border border-white/[0.08]">
                  {(
                    [
                      { id: 'queue', label: 'Antrean Aktif' },
                      { id: 'top', label: 'Top Tracks' },
                      { id: 'manual', label: 'Pilih Manual' },
                    ] as const
                  ).map((tab) => {
                    const active = sourceMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSourceMode(tab.id)}
                        className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-white text-[#0B0B0D] shadow-sm font-semibold'
                            : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {sourceMode === 'manual' ? (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-white/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        strokeWidth={1.9}
                      />
                      <input
                        type="text"
                        value={manualSearch}
                        onChange={(e) => setManualSearch(e.target.value)}
                        placeholder="Filter lagu dari antrean, disukai, atau lokal..."
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto rounded-xl bg-black/35 border border-white/[0.08] p-1.5 space-y-1">
                      {filteredCatalog.map((track) => {
                        const checked = manualTrackIds.includes(track.id);
                        const orderIndex = manualTrackIds.indexOf(track.id);
                        return (
                          <button
                            key={track.id}
                            type="button"
                            onClick={() => toggleManualTrack(track.id)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                              checked
                                ? 'bg-white/14 text-white'
                                : 'text-white/75 hover:bg-white/[0.06]'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                checked
                                  ? 'bg-white text-[#0B0B0D]'
                                  : 'border border-white/25 text-transparent'
                              }`}
                            >
                              {checked ? orderIndex + 1 : <Plus className="w-3 h-3" />}
                            </span>
                            <CoverArt
                              src={track.coverUrl}
                              alt={track.title}
                              sizeHint="sm"
                              className="w-8 h-8 shrink-0"
                              roundedClass="rounded-md"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{track.title}</p>
                              <p className="text-[11px] text-white/55 truncate">{track.artist}</p>
                            </div>
                            <span className="font-mono-tabular text-[11px] text-white/45 shrink-0">
                              {formatDuration(track.duration)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/55">
                    {sourceMode === 'queue'
                      ? 'Mengambil lagu yang sedang diputar beserta antrean berikutnya secara otomatis.'
                      : 'Mengambil daftar lagu yang paling sering kamu putar di Nocty.'}
                  </p>
                )}
              </section>

              <div className="border-t border-white/[0.08]" />

              {/* 2. Pesan Rahasia Barcode (1D Code 128) & Nomor Order */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="slip-secret-barcode"
                    className="text-sm font-semibold text-white"
                  >
                    Pesan Rahasia Barcode (Code 128)
                  </label>
                  <button
                    type="button"
                    onClick={() => setOrderCode(generateOrderCode())}
                    className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-3 h-3" strokeWidth={2} />
                    <span>Acak Order #{orderCode}</span>
                  </button>
                </div>

                <input
                  id="slip-secret-barcode"
                  type="text"
                  maxLength={44}
                  value={secretMessage}
                  onChange={(e) => setSecretMessage(e.target.value)}
                  placeholder={`Default: ${defaultShareUrl} — atau tulis pesan rahasia...`}
                  className="w-full h-11 px-3.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/55">
                  <span>
                    Terbaca saat di-scan:{' '}
                    <strong className="font-mono-tabular text-white/85">
                      {normalizeCode128Text(rawBarcodePayload)}
                    </strong>
                  </span>
                  <span className="font-mono-tabular">{secretMessage.length}/44</span>
                </div>
              </section>

              <div className="border-t border-white/[0.08]" />

              {/* 3. Spidol Coretan (Scribble Mode) & Stiker Mini */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Coretan Spidol &amp; Stiker</h3>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                      disabled={strokes.length === 0}
                      aria-label="Undo coretan terakhir"
                      className="min-h-[36px] px-2.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] disabled:opacity-35 text-xs text-white/85 inline-flex items-center gap-1 transition-colors"
                    >
                      <Undo2 className="w-3.5 h-3.5" strokeWidth={1.9} />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrokes([])}
                      disabled={strokes.length === 0}
                      aria-label="Hapus semua coretan"
                      className="min-h-[36px] px-2.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] disabled:opacity-35 text-xs text-white/85 inline-flex items-center gap-1 transition-colors"
                    >
                      <Eraser className="w-3.5 h-3.5" strokeWidth={1.9} />
                      <span>Bersihkan</span>
                    </button>
                  </div>
                </div>

                {/* Scribble Toggle + 3 Color Pickers */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScribbleActive((prev) => !prev)}
                    aria-pressed={isScribbleActive}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors whitespace-nowrap ${
                      isScribbleActive
                        ? 'bg-white text-[#0B0B0D] border-white'
                        : 'bg-white/[0.07] hover:bg-white/[0.12] text-white border-white/[0.10]'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{isScribbleActive ? 'Spidol Aktif (Selesai)' : 'Aktifkan Spidol'}</span>
                  </button>

                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08]">
                    {SCRIBBLE_COLORS.map((c) => {
                      const active = scribbleColor === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setScribbleColor(c.id);
                            setIsScribbleActive(true);
                          }}
                          aria-label={c.label}
                          title={c.label}
                          className={`w-7 h-7 rounded-full ${c.swatchClass} border-2 transition-transform ${
                            active
                              ? 'border-white scale-110 ring-2 ring-white/40'
                              : 'border-white/30 hover:scale-105'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Mini Stickers Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="inline-flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5" strokeWidth={1.85} />
                      <span>Tambah Stiker Mini (geser di struk untuk pindah posisi)</span>
                    </span>
                    {stickers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStickers([])}
                        className="inline-flex items-center gap-1 text-white/65 hover:text-white transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus Stiker</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {SLIP_STICKER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleAddSticker(opt)}
                        title={`Tambah stiker ${opt.label}`}
                        aria-label={`Tambah stiker ${opt.label}`}
                        className="min-h-[42px] rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.08] flex items-center justify-center transition-transform active:scale-95"
                      >
                        <AppleEmoji unified={opt.unified} size={22} alt={opt.label} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>

          </div>
        </div>

        {/* STICKY BOTTOM EXPORT BAR (Selalu terlihat tanpa perlu scroll di HP) */}
        <footer className="sticky bottom-0 z-20 shrink-0 px-4 sm:px-6 py-3 border-t border-white/[0.10] bg-[#121216]/95 backdrop-blur-xl flex items-center gap-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleSaveSlipPng}
            className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 disabled:opacity-50 text-sm font-semibold transition-all shadow-[0_8px_28px_rgba(255,255,255,0.18)] whitespace-nowrap"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
            ) : (
              <Download className="w-4 h-4" strokeWidth={2} />
            )}
            <span>
              {isExporting
                ? `Merender ${SLIP_EXPORT_WIDTH}×${SLIP_EXPORT_HEIGHT}...`
                : 'Simpan Slip (9:16)'}
            </span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleShareSlipStory}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.12] disabled:opacity-50 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4" strokeWidth={1.9} />
            <span className="hidden xs:inline sm:inline">Bagikan</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
