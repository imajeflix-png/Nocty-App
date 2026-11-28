import React from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { triggerHaptic } from '../utils/haptics';

const BARCODE_PATTERN = [
  2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 1, 2, 3, 1,
];

export const StudioView: React.FC = () => {
  const {
    currentTrack,
    queueTracks,
    setIsSlipModalOpen,
    setIsTwinModalOpen,
    setIsWeeklyAuraOpen,
  } = usePlayer();

  const previewTracks = [
    currentTrack || queueTracks[0] || { title: 'Midnight Tape', artist: 'Nocty', duration: 204 },
    queueTracks[1] || { title: 'Paper Static', artist: 'Analog', duration: 178 },
    queueTracks[2] || { title: 'After Hours', artist: 'Session', duration: 246 },
  ];

  const totalSec = previewTracks.reduce((sum, item) => sum + (item.duration || 180), 0);

  return (
    <div className="relative max-w-2xl mx-auto pb-44 lg:pb-12 space-y-12">
      {/* 1. Editorial Header */}
      <header className="pt-2 space-y-1.5">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Nocty Studio
        </h1>
        <p className="text-sm text-zinc-400">
          Cetak struk musik, dengarkan bersama, dan arsipkan selera audio.
        </p>
      </header>

      {/* 2. Primary Visual Showcase: Slip Nocty (Unboxed, physical paper floating on dark surface) */}
      <section aria-label="Slip Nocty Showcase">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            setIsSlipModalOpen(true);
          }}
          className="group w-full text-left flex flex-col sm:flex-row sm:items-center gap-8 sm:gap-10 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-2xl"
        >
          {/* Physical Tilted Receipt Paper Preview */}
          <div
            aria-hidden="true"
            className="on-artwork relative mx-auto sm:mx-0 w-[200px] sm:w-[210px] shrink-0 -rotate-[2.5deg] group-hover:rotate-0 group-hover:-translate-y-1 transition-all duration-300 ease-out"
          >
            <div
              className="rounded-sm px-4 py-4 shadow-[0_28px_60px_rgba(0,0,0,0.85),0_8px_20px_rgba(0,0,0,0.5)] border border-black/10"
              style={{
                backgroundColor: '#F5F3EC',
                color: '#141418',
              }}
            >
              <div className="flex items-center justify-between border-b border-dashed border-black/25 pb-2">
                <span className="font-mono-tabular text-[10px] font-bold tracking-[0.18em] uppercase">
                  NOCTY
                </span>
                <span className="font-mono-tabular text-[9px] tracking-wider opacity-60">
                  SLIP · 9:16
                </span>
              </div>

              <div className="mt-3 space-y-2 font-mono-tabular text-[10px]">
                {previewTracks.map((item, idx) => (
                  <div key={idx} className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">
                      0{idx + 1} {item.title}
                    </span>
                    <span className="opacity-65 shrink-0">
                      {formatDuration(item.duration || 180)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2 border-t border-dashed border-black/25 flex items-center justify-between font-mono-tabular text-[9.5px]">
                <span className="uppercase tracking-wider opacity-65">TOTAL</span>
                <span className="font-semibold">{formatDuration(totalSec)}</span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-black/15">
                <div className="flex items-end justify-between h-8 gap-[1.5px]">
                  {BARCODE_PATTERN.map((w, idx) => (
                    <span
                      key={idx}
                      className="h-full"
                      style={{
                        width: `${w}px`,
                        backgroundColor: '#141418',
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-center font-mono-tabular text-[8px] tracking-[0.26em] opacity-70">
                  NCT-0194-882
                </p>
              </div>
            </div>
          </div>

          {/* Editorial Copy & Minimal Action */}
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Slip Nocty
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Cetak kartu struk musik 9:16 siap bagikan lengkap dengan barcode yang bisa dipindai.
            </p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white group-hover:translate-x-1 transition-transform">
                <span>Buka Editor</span>
                <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" strokeWidth={2} />
              </span>
            </div>
          </div>
        </button>
      </section>

      {/* 3. Secondary Editorial Hairline List (No boxes, no colored icons, no neon badges) */}
      <section aria-label="Fitur Studio Lainnya" className="border-t border-white/[0.08]">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            setIsTwinModalOpen(true);
          }}
          className="group w-full py-5 border-b border-white/[0.08] flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <div className="space-y-1">
            <h3 className="font-display text-lg font-semibold tracking-tight text-white">
              Nocty Twin
            </h3>
            <p className="text-sm text-zinc-400 leading-snug">
              Dengarkan lagu secara sinkron bersama teman dalam satu sesi real-time
            </p>
          </div>
          <ChevronRight
            className="w-5 h-5 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0"
            strokeWidth={1.85}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            setIsWeeklyAuraOpen(true);
          }}
          className="group w-full py-5 border-b border-white/[0.08] flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <div className="space-y-1">
            <h3 className="font-display text-lg font-semibold tracking-tight text-white">
              Weekly Aura
            </h3>
            <p className="text-sm text-zinc-400 leading-snug">
              Ringkasan suasana hati mingguan dan poster musik 9:16
            </p>
          </div>
          <ChevronRight
            className="w-5 h-5 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0"
            strokeWidth={1.85}
          />
        </button>
      </section>
    </div>
  );
};


