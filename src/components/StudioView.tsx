import React from 'react';
import { ArrowUpRight, Heart, Radio, Receipt, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { triggerHaptic } from '../utils/haptics';

const MINI_BARCODE_WIDTHS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2];

export const StudioView: React.FC = () => {
  const {
    currentTrack,
    ambientPalette,
    setIsSlipModalOpen,
    setIsTwinModalOpen,
    setIsWeeklyAuraOpen,
  } = usePlayer();

  const { primary, secondary } = ambientPalette;

  return (
    <div className="relative max-w-3xl mx-auto pb-44 lg:pb-12 space-y-6">
      {/* Subtle Ambient Liquid Glass Depth Glow */}
      <div
        aria-hidden="true"
        className="ambient-aura-layer pointer-events-none absolute -top-10 inset-x-0 h-64 blur-3xl opacity-30"
        style={{
          background: `
            radial-gradient(circle at 22% 25%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85) 0%, transparent 60%),
            radial-gradient(circle at 80% 60%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.78) 0%, transparent 60%)
          `,
        }}
      />

      {/* 1. Clean iOS Studio Header */}
      <header className="relative z-10 pt-1 space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Nocty Studio
        </h1>
        <p className="text-xs sm:text-sm text-white/60">
          Cetak &amp; bagikan momen musikmu
        </p>
      </header>

      {/* 2. Apple iOS 26 Liquid Glass Bento Grid */}
      <section aria-label="Nocty Studio Bento Grid" className="relative z-10 space-y-3.5">
        {/* Hero Card (Full Width): Slip Nocty with Mini Receipt + Barcode Preview */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            setIsSlipModalOpen(true);
          }}
          className="group relative w-full overflow-hidden rounded-[28px] bg-white/[0.07] hover:bg-white/[0.11] backdrop-blur-3xl backdrop-saturate-150 saturate-150 border border-white/[0.18] p-5 sm:p-6 text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-[0.99] flex items-center justify-between gap-4 sm:gap-6"
        >
          {/* Specular top glass highlight */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-10 -bottom-12 w-48 h-48 rounded-full bg-sky-400/15 blur-3xl group-hover:bg-sky-400/25 transition-colors"
          />

          {/* Left: Info & Pill CTA */}
          <div className="relative z-10 flex flex-col justify-between gap-4 min-w-0 flex-1">
            <div className="space-y-3">
              <span className="w-11 h-11 rounded-[14px] bg-sky-500/25 border border-sky-300/40 text-sky-200 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_rgba(56,189,248,0.22)]">
                <Receipt className="w-5 h-5" strokeWidth={1.9} />
              </span>

              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Slip Nocty
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-white/65">
                  Struk musik 9:16 &amp; barcode scan
                </p>
              </div>
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#0B0B0D] text-xs font-semibold shadow-[0_6px_20px_rgba(255,255,255,0.25)] group-hover:scale-[1.02] transition-transform whitespace-nowrap">
                <span>Buat Slip</span>
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.2} />
              </span>
            </div>
          </div>

          {/* Right: Mini Visual Receipt Paper & Code 128 Barcode Preview */}
          <div
            aria-hidden="true"
            className="on-artwork relative z-10 w-[114px] sm:w-[142px] shrink-0 rotate-[3deg] group-hover:rotate-[1deg] group-hover:scale-[1.03] transition-transform duration-300"
          >
            <div
              className="rounded-xl p-2.5 sm:p-3 shadow-[0_14px_30px_rgba(0,0,0,0.48)] border border-black/10"
              style={{
                backgroundColor: '#F7F5EE',
                color: '#16161A',
              }}
            >
              <div className="flex items-center justify-between border-b border-dashed border-black/20 pb-1.5">
                <span className="font-mono-tabular text-[8px] sm:text-[9px] font-bold tracking-wider uppercase">
                  NOCTY SLIP
                </span>
                <span className="font-mono-tabular text-[7px] opacity-60">9:16</span>
              </div>

              <div className="mt-2 space-y-1.5 font-mono-tabular text-[7.5px] sm:text-[8.5px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-semibold">
                    01 {currentTrack?.title || 'Lofi Midnight'}
                  </span>
                  <span className="opacity-65 shrink-0">3:24</span>
                </div>
                <div className="flex items-center justify-between gap-1 opacity-75">
                  <span className="truncate">02 Velvet Echo</span>
                  <span className="shrink-0">2:58</span>
                </div>
                <div className="flex items-center justify-between gap-1 opacity-60">
                  <span className="truncate">03 Starlight</span>
                  <span className="shrink-0">4:10</span>
                </div>
              </div>

              <div className="mt-2.5 pt-1.5 border-t border-dashed border-black/20">
                <div className="flex items-end justify-between h-5 sm:h-6 gap-[1.5px] px-0.5">
                  {MINI_BARCODE_WIDTHS.map((w, idx) => (
                    <span
                      key={idx}
                      className="h-full rounded-[0.5px]"
                      style={{
                        width: `${w}px`,
                        backgroundColor: '#141418',
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1 text-center font-mono-tabular text-[6.5px] tracking-[0.22em] opacity-65">
                  NOCTY-8241
                </p>
              </div>
            </div>
          </div>
        </button>

        {/* Bottom 2-Column Bento Grid: Nocty Twin & Aura & Kartu */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Left Column: Nocty Twin */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              setIsTwinModalOpen(true);
            }}
            className="group relative overflow-hidden rounded-[28px] bg-white/[0.07] hover:bg-white/[0.11] backdrop-blur-3xl backdrop-saturate-150 saturate-150 border border-white/[0.18] p-4 sm:p-5 text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-[0.98] flex flex-col justify-between gap-5 min-h-[168px] sm:min-h-[184px]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-rose-500/20 blur-2xl group-hover:bg-rose-500/30 transition-colors"
            />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-rose-500/35 to-pink-500/20 border border-rose-300/40 text-rose-200 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_8px_22px_rgba(244,63,94,0.35)] shrink-0">
                <Heart className="w-5 h-5 fill-rose-300/80" strokeWidth={1.9} />
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-400/15 backdrop-blur-md border border-rose-300/35 text-[11px] font-semibold text-rose-100 whitespace-nowrap">
                <Radio className="w-3 h-3" strokeWidth={2.2} />
                <span>Live</span>
              </span>
            </div>

            <div className="relative z-10">
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                Nocty Twin
              </h2>
              <p className="mt-0.5 text-xs text-white/65 truncate">
                Dengar bareng real-time
              </p>
            </div>
          </button>

          {/* Right Column: Aura & Kartu */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              setIsWeeklyAuraOpen(true);
            }}
            className="group relative overflow-hidden rounded-[28px] bg-white/[0.07] hover:bg-white/[0.11] backdrop-blur-3xl backdrop-saturate-150 saturate-150 border border-white/[0.18] p-4 sm:p-5 text-left shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-[0.98] flex flex-col justify-between gap-5 min-h-[168px] sm:min-h-[184px]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-indigo-500/22 blur-2xl group-hover:bg-indigo-500/32 transition-colors"
            />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-indigo-500/35 to-violet-500/20 border border-indigo-300/40 text-indigo-200 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_8px_22px_rgba(99,102,241,0.38)] shrink-0">
                <Sparkles className="w-5 h-5" strokeWidth={1.9} />
              </span>

              <ArrowUpRight
                className="w-4 h-4 text-white/45 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 mt-1"
                strokeWidth={2}
              />
            </div>

            <div className="relative z-10">
              <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                Aura &amp; Kartu
              </h2>
              <p className="mt-0.5 text-xs text-white/65 truncate">
                Raport suasana hati 9:16
              </p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};

