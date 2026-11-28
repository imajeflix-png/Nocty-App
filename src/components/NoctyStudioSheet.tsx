import React, { useEffect } from 'react';
import {
  ChevronRight,
  Flame,
  Image as ImageIcon,
  Plane,
  Receipt,
  Sparkles,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AppleEmoji } from './AppleEmoji';

export const NoctyStudioSheet: React.FC = () => {
  const {
    isStudioSheetOpen,
    setIsStudioSheetOpen,
    setIsSlipModalOpen,
    setIsTwinModalOpen,
    setIsLyricCardOpen,
    setIsWhisperComposerOpen,
    currentTrack,
    ambientPalette,
    pushToast,
  } = usePlayer();

  useEffect(() => {
    if (!isStudioSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsStudioSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isStudioSheetOpen, setIsStudioSheetOpen]);

  if (!isStudioSheetOpen) return null;

  const { primary, secondary } = ambientPalette;

  const openSlip = () => {
    setIsStudioSheetOpen(false);
    setIsSlipModalOpen(true);
  };

  const openTwin = () => {
    setIsStudioSheetOpen(false);
    setIsTwinModalOpen(true);
  };

  const openLyricCard = () => {
    if (!currentTrack) {
      pushToast('Putar lagu terlebih dahulu untuk membuat Kartu Lirik', 'info');
      return;
    }
    setIsStudioSheetOpen(false);
    setIsLyricCardOpen(true);
  };

  const openWhisper = () => {
    if (!currentTrack) {
      pushToast('Putar lagu terlebih dahulu untuk mengirim Whisper', 'info');
      return;
    }
    setIsStudioSheetOpen(false);
    setIsWhisperComposerOpen(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nocty Studio"
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-md"
        onClick={() => setIsStudioSheetOpen(false)}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-[28px] sm:rounded-[28px] bg-[#141418]/90 backdrop-blur-2xl border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_24px_70px_rgba(0,0,0,0.75)] overflow-hidden">
        {/* Soft Cover-Adaptive Glow */}
        <div
          aria-hidden="true"
          className="ambient-aura-layer pointer-events-none absolute -top-20 inset-x-0 h-48 blur-3xl opacity-35"
          style={{
            background: `
              radial-gradient(circle at 25% 30%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9) 0%, transparent 65%),
              radial-gradient(circle at 75% 40%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.8) 0%, transparent 65%)
            `,
          }}
        />

        {/* Mobile Bottom Sheet Handle */}
        <div className="relative z-10 pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        {/* Sheet Header */}
        <header className="relative z-10 flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-[10px] bg-white/[0.12] border border-white/[0.18] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28)] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-white truncate">
                Nocty Studio
              </h2>
              <p className="text-xs text-white/60 truncate">
                Semua fitur kreatif &amp; sosial Nocty dalam satu tempat
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsStudioSheetOpen(false)}
            aria-label="Tutup Nocty Studio"
            className="min-w-[36px] min-h-[36px] rounded-full bg-white/10 hover:bg-white/16 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </header>

        {/* Studio Feature Cards */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="space-y-2.5">
            {/* 1. Slip Nocty */}
            <button
              type="button"
              onClick={openSlip}
              className="group w-full flex items-center justify-between gap-3.5 p-3.5 rounded-[20px] bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.14] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)] text-left transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-11 h-11 rounded-[14px] bg-sky-500/25 border border-sky-300/35 text-sky-200 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28)]">
                  <Receipt className="w-5 h-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-white truncate">
                    Slip Nocty
                  </p>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    Struk 9:16 (Denim, Gingham, Editorial &amp; Nocturnal Aura) + Code 128
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* 2. Nocty Twin */}
            <button
              type="button"
              onClick={openTwin}
              className="group w-full flex items-center justify-between gap-3.5 p-3.5 rounded-[20px] bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.14] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)] text-left transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-11 h-11 rounded-[14px] bg-rose-500/25 border border-rose-300/35 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28)]">
                  <AppleEmoji unified="1f3a7" size={20} alt="Nocty Twin" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-white truncate">
                    Nocty Twin
                  </p>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    Dengar bareng real-time &amp; kirim Tap Heart ke teman
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Compact secondary studio actions: Kartu Lirik & Kirim Whisper */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={openLyricCard}
                className="flex items-center gap-2.5 p-3 rounded-[18px] bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.10] text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-[10px] bg-emerald-500/20 border border-emerald-300/30 text-emerald-200 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Kartu Lirik</p>
                  <p className="text-[11px] text-white/50 truncate">Poster 9:16</p>
                </div>
              </button>

              <button
                type="button"
                onClick={openWhisper}
                className="flex items-center gap-2.5 p-3 rounded-[18px] bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.10] text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-[10px] bg-amber-500/20 border border-amber-300/30 text-amber-200 flex items-center justify-center shrink-0">
                  <AppleEmoji unified="1f48c" size={16} alt="Whisper" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Kirim Whisper</p>
                  <p className="text-[11px] text-white/50 truncate">Pesan lagu</p>
                </div>
              </button>
            </div>
          </div>

          {/* 4. Slot Siap Pakai untuk Fitur Mendatang */}
          <div className="space-y-2 pt-1">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Segera Hadir di Studio
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center gap-3 p-3 rounded-[18px] bg-white/[0.03] border border-dashed border-white/[0.12] opacity-75">
                <span className="w-9 h-9 rounded-[11px] bg-white/[0.08] border border-white/[0.12] text-white/70 flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4" strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/90 truncate">
                    Boarding Pass
                  </p>
                  <p className="text-[11px] text-white/50 truncate">
                    Tiket perjalanan musik · Segera hadir
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-[18px] bg-white/[0.03] border border-dashed border-white/[0.12] opacity-75">
                <span className="w-9 h-9 rounded-[11px] bg-white/[0.08] border border-white/[0.12] text-white/70 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/90 truncate">
                    Roast My Taste
                  </p>
                  <p className="text-[11px] text-white/50 truncate">
                    Komentar selera musik · Segera hadir
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
