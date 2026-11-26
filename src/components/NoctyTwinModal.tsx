import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Loader2,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import {
  TWIN_BADGE_META,
  TwinBadge,
  renderTwinReceiptPosterPng,
} from '../utils/twinReceiptCanvas';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';

interface FloatingPulse {
  id: number;
  unified: string;
  leftPercent: number;
  size: number;
}

const TWIN_REACTION_EMOJIS: Array<{ unified: string; label: string }> = [
  { unified: '2764-fe0f', label: 'Heart' },
  { unified: '1f97a', label: 'Pleading' },
  { unified: '1f525', label: 'Fire' },
  { unified: '2728', label: 'Sparkles' },
  { unified: '1f319', label: 'Crescent Moon' },
];

const TWIN_BADGES: TwinBadge[] = ['Couple / LDR', 'Late Night Bestie', 'Just Friend'];

export const NoctyTwinModal: React.FC = () => {
  const {
    isTwinModalOpen,
    setIsTwinModalOpen,
    currentTrack,
    indonesiaTrending,
    ambientPalette,
    pushToast,
  } = usePlayer();

  const [partnerName, setPartnerName] = useState('Pasanganmu');
  const [badge, setBadge] = useState<TwinBadge>('Couple / LDR');
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('twin') || `NOCTY-${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [pulses, setPulses] = useState<FloatingPulse[]>([]);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [sessionMinutes] = useState(() => Math.floor(18 + Math.random() * 24));
  const [syncPercent] = useState(() => Math.floor(88 + Math.random() * 11));

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isRenderingReceipt, setIsRenderingReceipt] = useState(false);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);

  const channelRef = useRef<BroadcastChannel | null>(null);

  const displayTrack = useMemo(
    () => currentTrack || indonesiaTrending[0] || null,
    [currentTrack, indonesiaTrending]
  );

  // Sync Tap Pulse across tabs via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(`nocty_twin_${roomCode}`);
    channelRef.current = ch;

    ch.onmessage = (event) => {
      if (event.data?.type === 'pulse' && typeof event.data.unified === 'string') {
        spawnFloatingPulse(event.data.unified);
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [roomCode]);

  // Auto-open if user lands on ?twin=ROOM
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('twin')) {
      setIsTwinModalOpen(true);
    }
  }, [setIsTwinModalOpen]);

  useEffect(() => {
    if (!isTwinModalOpen) {
      setIsReceiptOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isReceiptOpen) setIsReceiptOpen(false);
        else setIsTwinModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTwinModalOpen, isReceiptOpen, setIsTwinModalOpen]);

  const spawnFloatingPulse = (unified: string) => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    const leftPercent = 14 + Math.random() * 72;
    const size = 28 + Math.floor(Math.random() * 12);
    setPulses((prev) => [...prev.slice(-14), { id, unified, leftPercent, size }]);
    window.setTimeout(() => {
      setPulses((prev) => prev.filter((p) => p.id !== id));
    }, 2300);
  };

  const handleTapPulse = (unified: string) => {
    spawnFloatingPulse(unified);
    try {
      channelRef.current?.postMessage({ type: 'pulse', unified });
    } catch {
      // Ignore
    }
  };

  const handleCopyInvite = async () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('twin', roomCode);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedInvite(true);
      pushToast('Link room Nocty Twin berhasil disalin!', 'success');
      window.setTimeout(() => setCopiedInvite(false), 2200);
    } catch {
      pushToast(`Kode Room Twin: ${roomCode}`, 'info');
    }
  };

  const handleOpenReceipt = async () => {
    setIsReceiptOpen(true);
    setIsRenderingReceipt(true);
    try {
      const { blob, dataUrl } = await renderTwinReceiptPosterPng({
        track: displayTrack,
        partnerName: partnerName.trim() || 'Twin',
        badge,
        syncPercent,
        sessionMinutes,
        palette: ambientPalette,
      });
      setReceiptBlob(blob);
      setReceiptDataUrl(dataUrl);
    } catch {
      pushToast('Gagal membuat Nocty Twin Receipt', 'info');
      setIsReceiptOpen(false);
    } finally {
      setIsRenderingReceipt(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptBlob && !receiptDataUrl) return;
    const url = receiptBlob ? URL.createObjectURL(receiptBlob) : receiptDataUrl!;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nocty-twin-receipt.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (receiptBlob) {
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    pushToast('Nocty Twin Receipt 9:16 berhasil diunduh', 'success');
  };

  const handleShareReceipt = async () => {
    if (!receiptBlob) return;
    const file = new File([receiptBlob], 'nocty-twin-receipt.png', { type: 'image/png' });
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: 'Nocty Twin Music Receipt',
          text: `${badge} · Mendengarkan ${displayTrack?.title || 'musik'} bersama di Nocty`,
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    handleDownloadReceipt();
    pushToast('Gambar diunduh untuk dibagikan ke IG Story', 'info');
  };

  if (!isTwinModalOpen) return null;

  const { primary, secondary } = ambientPalette;
  const activeBadgeMeta = TWIN_BADGE_META[badge];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nocty Twin"
      className="fixed inset-0 z-[72] flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/78 backdrop-blur-xl"
        onClick={() => setIsTwinModalOpen(false)}
        aria-hidden="true"
      />

      {/* Floating Tap Pulse / Heart Reaction Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      >
        {pulses.map((p) => (
          <div
            key={p.id}
            className="absolute bottom-24 animate-float-pulse drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
            style={{ left: `${p.leftPercent}%` }}
          >
            <AppleEmoji unified={p.unified} size={p.size} />
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-[#121216]/92 backdrop-blur-2xl border border-white/[0.13] shadow-[0_32px_90px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Ambient Dual Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 inset-x-0 h-56 blur-3xl opacity-30"
          style={{
            background: `
              radial-gradient(circle at 25% 30%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.95) 0%, transparent 65%),
              radial-gradient(circle at 80% 70%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.85) 0%, transparent 65%)
            `,
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-full bg-white/10 border border-white/[0.12] flex items-center justify-center shrink-0">
              <AppleEmoji unified="1f3a7" size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-white truncate">
                  Nocty Twin
                </h2>
                <span className="font-mono-tabular text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/75">
                  {syncPercent}% Sync
                </span>
              </div>
              <p className="text-xs text-white/55 truncate">
                Dengarkan lagu bersama &amp; kirim Tap Pulse real-time
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTwinModalOpen(false)}
            aria-label="Tutup Nocty Twin"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.9} />
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {/* Active Twin Status & Badge */}
          <div className="rounded-2xl bg-white/[0.06] border border-white/[0.10] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/12 border border-white/[0.14] text-xs font-semibold text-white">
                <AppleEmoji unified={activeBadgeMeta.unified} size={15} />
                <span>{badge}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <Users className="w-3.5 h-3.5" strokeWidth={1.85} />
                <span>Kamu &amp; {partnerName || 'Twin'}</span>
              </div>
            </div>

            {displayTrack && (
              <div className="flex items-center gap-3 pt-1">
                <CoverArt
                  src={displayTrack.coverUrl}
                  alt={displayTrack.title}
                  className="w-14 h-14 shrink-0 shadow-lg"
                  roundedClass="rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-white/45 font-medium">
                    Sedang Didengar Bersama
                  </p>
                  <p className="text-sm font-semibold text-white truncate mt-0.5">
                    {displayTrack.title}
                  </p>
                  <p className="text-xs text-white/60 truncate">{displayTrack.artist}</p>
                </div>
              </div>
            )}
          </div>

          {/* Partner Name & Relationship Badge Selector */}
          <div className="space-y-3">
            <div>
              <label htmlFor="twin-partner" className="block text-xs font-medium text-white/80 mb-1.5">
                Nama Pasangan / Twin
              </label>
              <input
                id="twin-partner"
                type="text"
                maxLength={32}
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Nama Twin kamu..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-white/80 mb-1.5">
                Badge Hubungan
              </span>
              <div className="flex flex-wrap gap-2">
                {TWIN_BADGES.map((option) => {
                  const meta = TWIN_BADGE_META[option];
                  const active = badge === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setBadge(option)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-[#0B0B0D]'
                          : 'bg-white/[0.07] hover:bg-white/[0.12] text-white/80 border border-white/[0.08]'
                      }`}
                    >
                      <AppleEmoji unified={meta.unified} size={15} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tap Pulse / Heart Floating iOS Emoji Reactions */}
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.09] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Tap Pulse / Heart</span>
              <span className="text-[11px] text-white/50">Ketuk untuk kirim ke layar pasangan</span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {TWIN_REACTION_EMOJIS.map((item) => (
                <button
                  key={item.unified}
                  type="button"
                  onClick={() => handleTapPulse(item.unified)}
                  aria-label={`Kirim reaksi ${item.label}`}
                  className="flex-1 h-12 rounded-2xl bg-white/[0.07] hover:bg-white/[0.15] active:scale-90 border border-white/[0.09] flex items-center justify-center transition-all"
                >
                  <AppleEmoji unified={item.unified} size={24} alt={item.label} />
                </button>
              ))}
            </div>
          </div>

          {/* Room Invite Code */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/30 border border-white/[0.08]">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              aria-label="Kode Room Twin"
              className="flex-1 min-w-0 bg-transparent px-2 font-mono-tabular text-xs text-white/85 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/18 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.9} />
                  <span>Undang Twin</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="relative z-10 flex items-center justify-between gap-2.5 px-5 py-3.5 border-t border-white/[0.08] bg-white/[0.02] shrink-0">
          <button
            type="button"
            onClick={() => setIsTwinModalOpen(false)}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs font-medium text-white/80 transition-colors"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleOpenReceipt}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 text-xs font-semibold transition-all shadow-[0_8px_24px_rgba(255,255,255,0.2)]"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Cetak Twin Receipt (9:16)</span>
          </button>
        </div>
      </div>

      {/* 9:16 Twin Music Receipt Export Preview */}
      {isReceiptOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-black/82 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#121216]/95 border border-white/[0.14] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Nocty Twin Receipt 9:16
                </h3>
                <p className="text-xs text-white/55">Siap dibagikan ke Instagram Story</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                aria-label="Tutup preview receipt"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mx-auto w-[220px] aspect-[9/16] rounded-2xl overflow-hidden bg-black/50 border border-white/[0.12] flex items-center justify-center shadow-2xl">
              {isRenderingReceipt || !receiptDataUrl ? (
                <Loader2 className="w-6 h-6 text-white/75 animate-spin" />
              ) : (
                <img
                  src={receiptDataUrl}
                  alt="Nocty Twin Music Receipt"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={isRenderingReceipt || !receiptBlob}
                onClick={handleShareReceipt}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 disabled:opacity-45 text-xs sm:text-sm font-semibold transition-colors"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
                <span>Bagikan ke IG Story</span>
              </button>

              <button
                type="button"
                disabled={isRenderingReceipt || !receiptBlob}
                onClick={handleDownloadReceipt}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.10] disabled:opacity-45 text-xs sm:text-sm font-medium text-white transition-colors"
              >
                <Download className="w-4 h-4" strokeWidth={1.9} />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
