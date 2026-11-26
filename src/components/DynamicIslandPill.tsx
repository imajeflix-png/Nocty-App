import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';

export const DynamicIslandPill: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    isZenMode,
    setIsZenMode,
    currentTime,
    duration,
    ambientPalette,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setIsTwinModalOpen,
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  // Automatically collapse when fullscreen Now Playing opens or playback resets
  useEffect(() => {
    if (isZenMode || !currentTrack) {
      setIsExpanded(false);
    }
  }, [isZenMode, currentTrack]);

  // Collapse on Escape or pointerdown outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    const handleOutsidePointer = (e: PointerEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [isExpanded]);

  const shouldRender = Boolean(
    currentTrack && !isZenMode && (isPlaying || isBuffering || isExpanded)
  );

  if (!shouldRender || !currentTrack) {
    return null;
  }

  const { primary } = ambientPalette;
  const eqColor = `rgb(${primary.r}, ${primary.g}, ${primary.b})`;
  const liveProgress =
    duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const displayProgress = scrubProgress !== null ? scrubProgress : liveProgress;
  const displayTime =
    scrubProgress !== null && duration > 0 ? scrubProgress * duration : currentTime;

  const computeRatioFromClientX = (clientX: number): number => {
    const el = progressBarRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (duration <= 0) return;
    isScrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubProgress(computeRatioFromClientX(e.clientX));
  };

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current || duration <= 0) return;
    setScrubProgress(computeRatioFromClientX(e.clientX));
  };

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    const finalRatio = computeRatioFromClientX(e.clientX);
    setScrubProgress(null);
    if (duration > 0) {
      seekTo(finalRatio * duration);
    }
  };

  const useMarquee = currentTrack.title.length > 13;

  return (
    <>
      {isExpanded && (
        <div
          aria-hidden="true"
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[1px] transition-opacity duration-300"
        />
      )}

      <div
        ref={islandRef}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-40 on-artwork select-none"
      >
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label={`Dynamic Island: ${currentTrack.title} oleh ${currentTrack.artist}. Ketuk untuk memperluas.`}
            className="island-spring group flex items-center justify-between gap-2.5 h-9 w-[166px] sm:w-[216px] px-2 rounded-full bg-black/95 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.65)] hover:scale-[1.03] active:scale-[0.97] cursor-pointer overflow-hidden"
          >
            {/* Left: Spinning Circular Album Cover */}
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 ring-1 ring-white/15">
              <CoverArt
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`w-full h-full animate-disc-spin ${
                  isPlaying ? 'disc-running' : 'disc-paused'
                }`}
                roundedClass="rounded-full"
              />
            </div>

            {/* Center: Smooth Scrolling Title */}
            <div className="flex-1 min-w-0 overflow-hidden text-left">
              {useMarquee ? (
                <div className="animate-island-marquee text-[11px] font-medium text-white whitespace-nowrap">
                  <span className="pr-6">{currentTrack.title}</span>
                  <span className="pr-6" aria-hidden="true">
                    {currentTrack.title}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-white truncate text-center">
                  {currentTrack.title}
                </p>
              )}
            </div>

            {/* Right: 4-Bar Mini Equalizer Matched to Album Cover */}
            <div className="pr-1 shrink-0 flex items-center">
              <EqualizerBars
                active={isPlaying}
                className="h-3"
                barColor={eqColor}
              />
            </div>
          </button>
        ) : (
          <div
            role="dialog"
            aria-label="Dynamic Island Music Control"
            className="island-spring relative w-[min(92vw,364px)] rounded-[28px] backdrop-blur-2xl bg-[#141418]/85 border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.72)] p-4 text-white overflow-hidden"
          >
            {/* Subtle Ambient Cover Tint inside Expanded Card */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-28 rounded-full blur-3xl opacity-30"
              style={{
                background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9), transparent 70%)`,
              }}
            />

            <div className="relative z-10 space-y-3.5">
              {/* Top Row: Cover, Title/Artist & Colored Equalizer */}
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsZenMode(true);
                  }}
                  aria-label="Buka layar penuh Now Playing"
                  className="relative shrink-0 rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/15 hover:scale-[1.03] transition-transform"
                >
                  <CoverArt
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-14 h-14"
                    roundedClass="rounded-2xl"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-white truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-white/65 truncate mt-0.5">
                    {currentTrack.artist}
                  </p>
                </div>

                <div className="shrink-0 pl-1">
                  <EqualizerBars
                    active={isPlaying}
                    className="h-4"
                    barColor={eqColor}
                  />
                </div>
              </div>

              {/* Interactive Scrubbing Progress Bar */}
              <div className="space-y-1">
                <div
                  ref={progressBarRef}
                  onPointerDown={handleScrubPointerDown}
                  onPointerMove={handleScrubPointerMove}
                  onPointerUp={handleScrubPointerUp}
                  onPointerCancel={handleScrubPointerUp}
                  role="slider"
                  aria-label="Progress lagu"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration || 0)}
                  aria-valuenow={Math.round(displayTime || 0)}
                  className="group py-2 cursor-pointer touch-none"
                >
                  <div className="relative h-1.5 group-hover:h-2 transition-all rounded-full bg-white/18 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-75"
                      style={{
                        width: `${displayProgress * 100}%`,
                        backgroundColor: eqColor,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between font-mono-tabular text-[11px] text-white/55">
                  <span>{formatDuration(displayTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Primary Playback Controls */}
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={playPrev}
                  aria-label="Lagu sebelumnya"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 active:scale-95 transition-all"
                >
                  <SkipBack className="w-5 h-5 fill-current" strokeWidth={1.75} />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  className="w-12 h-12 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_6px_24px_rgba(255,255,255,0.22)]"
                >
                  {isBuffering ? (
                    <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-[#0B0B0D]" strokeWidth={2} />
                  ) : (
                    <Play className="w-5 h-5 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  aria-label="Lagu berikutnya"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/12 active:scale-95 transition-all"
                >
                  <SkipForward className="w-5 h-5 fill-current" strokeWidth={1.75} />
                </button>
              </div>

              {/* Bottom Quick Actions: Nocty Twin & Buka Layar Penuh */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsTwinModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap"
                >
                  <AppleEmoji unified="1f3a7" size={14} />
                  <span>Nocty Twin</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsZenMode(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.14] hover:bg-white/[0.22] border border-white/[0.14] text-xs font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Maximize2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                  <span>Buka Layar Penuh</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
