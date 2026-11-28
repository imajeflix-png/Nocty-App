import React from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';
import { useNetworkMode } from '../context/NetworkModeContext';

export const NetworkModePrompt: React.FC = () => {
  const {
    isWeakNetworkPromptVisible,
    isRecoveryPromptVisible,
    acceptLiteMode,
    dismissLitePrompt,
    acceptNormalMode,
    dismissRecoveryPrompt,
  } = useNetworkMode();

  if (!isWeakNetworkPromptVisible && !isRecoveryPromptVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-[122px] lg:bottom-[104px] left-1/2 -translate-x-1/2 z-[70] w-[min(94vw,430px)] px-1 pointer-events-auto">
      {isWeakNetworkPromptVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl bg-[#121216]/92 backdrop-blur-md border border-white/[0.12] shadow-[0_18px_48px_rgba(0,0,0,0.65)] p-4 text-white"
        >
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-300/25 flex items-center justify-center shrink-0 mt-0.5 text-amber-300">
              <WifiOff className="w-4 h-4" strokeWidth={1.9} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-semibold text-white leading-snug">
                  Koneksi Terdeteksi Kurang Stabil
                </p>
                <button
                  type="button"
                  onClick={dismissLitePrompt}
                  aria-label="Tutup notifikasi mode ringan"
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0 -mr-1 -mt-0.5"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
              <p className="mt-1 text-xs text-white/70 leading-relaxed">
                Beralih ke Mode Ringan agar lagu tetap lancar tanpa buffering? Mode ini akan
                menonaktifkan latar video, menurunkan resolusi sampul album, dan menyederhanakan efek
                animasi.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={acceptLiteMode}
                  className="px-3.5 py-1.5 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Aktifkan Mode Ringan
                </button>
                <button
                  type="button"
                  onClick={dismissLitePrompt}
                  className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] text-xs font-medium text-white/85 transition-colors whitespace-nowrap"
                >
                  Tetap Mode Normal
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl bg-[#121216]/92 backdrop-blur-md border border-white/[0.12] shadow-[0_18px_48px_rgba(0,0,0,0.65)] p-4 text-white"
        >
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-400/15 border border-emerald-300/25 flex items-center justify-center shrink-0 mt-0.5 text-emerald-300">
              <Wifi className="w-4 h-4" strokeWidth={1.9} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-semibold text-white leading-snug">
                  Koneksi Kembali Cepat
                </p>
                <button
                  type="button"
                  onClick={dismissRecoveryPrompt}
                  aria-label="Tetap di Mode Ringan"
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0 -mr-1 -mt-0.5"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
              <p className="mt-1 text-xs text-white/70 leading-relaxed">
                Kecepatan jaringan stabil kembali. Ingin mengembalikan tampilan Apple Glassmorphism
                dan kualitas sampul penuh?
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={acceptNormalMode}
                  className="px-3.5 py-1.5 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Kembali ke Mode Normal
                </button>
                <button
                  type="button"
                  onClick={dismissRecoveryPrompt}
                  className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] text-xs font-medium text-white/85 transition-colors whitespace-nowrap"
                >
                  Tetap Mode Ringan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
