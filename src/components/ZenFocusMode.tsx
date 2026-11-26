import React, { useEffect, useRef } from 'react';
import {
  Heart,
  Loader2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { SyncedLyricsList } from './SyncedLyricsList';

export const ZenFocusMode: React.FC = () => {
  const {
    isZenMode,
    setIsZenMode,
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    isShuffled,
    loopMode,
    ambientColor,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    toggleShuffle,
    cycleLoopMode,
    toggleLike,
    isLiked,
  } = usePlayer();

  const seekRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isZenMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZenMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isZenMode, setIsZenMode]);

  if (!isZenMode) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zen Focus Mode"
      className="fixed inset-0 z-50 bg-[#0B0B0F] flex flex-col overflow-hidden"
    >
      {/* Adaptive Cover Ambient Radial Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{
          background: `
            radial-gradient(circle at 24% 38%, rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, 0.28) 0%, transparent 55%),
            radial-gradient(circle at 78% 65%, rgba(16, 185, 129, 0.14) 0%, transparent 55%)
          `,
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Noct<span className="text-neon-gradient">y</span>
          </span>
          <span className="text-xs text-[#9499A6]" aria-hidden="true">·</span>
          <span className="text-xs text-[#9499A6]">Focus Mode</span>
        </div>

        <button
          type="button"
          onClick={() => setIsZenMode(false)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap"
        >
          <Minimize2 className="w-4 h-4 text-lime-300" strokeWidth={1.75} />
          <span>Keluar Focus</span>
        </button>
      </header>

      {/* Main Split Stage: Large Cover Left + Immersive Lyrics Right */}
      <div className="relative z-10 flex-1 min-h-0 max-w-6xl w-full mx-auto px-6 sm:px-10 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left: Oversized Artwork & Minimalist Controls */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start">
          <div className="relative group">
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-3xl blur-2xl opacity-45 transition-all duration-700"
              style={{
                background: `radial-gradient(circle, rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, 0.65), transparent 70%)`,
              }}
            />
            <CoverArt
              src={currentTrack?.coverUrl}
              alt={currentTrack?.title || 'Nocty'}
              className="relative w-52 h-52 sm:w-72 sm:h-72 lg:w-80 lg:h-80 shadow-2xl ring-1 ring-white/15"
              roundedClass="rounded-3xl"
            />
          </div>

          <div className="mt-6 w-full max-w-sm text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-center lg:justify-start gap-2.5">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                    {currentTrack ? currentTrack.title : 'Belum Ada Lagu'}
                  </h2>
                  {currentTrack && isPlaying && <EqualizerBars active={true} />}
                </div>
                <p className="mt-1 text-sm text-[#9499A6] truncate">
                  {currentTrack ? currentTrack.artist : 'Pilih lagu untuk mulai'}
                </p>
              </div>

              {currentTrack && (
                <button
                  type="button"
                  onClick={() => toggleLike(currentTrack)}
                  aria-label="Sukai lagu"
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    liked ? 'text-lime-300' : 'text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${liked ? 'fill-lime-300' : ''}`} strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Seek Bar */}
            <div className="mt-5">
              <div
                ref={seekRef}
                onClick={(e) => {
                  if (!seekRef.current || duration <= 0) return;
                  const rect = seekRef.current.getBoundingClientRect();
                  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                  seekTo(ratio * duration);
                }}
                className="group py-2 cursor-pointer"
              >
                <div className="h-1.5 group-hover:h-2 transition-all rounded-full bg-white/[0.12] overflow-hidden">
                  <div
                    className="h-full bg-neon-gradient rounded-full"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between font-mono-tabular text-xs text-[#9499A6]">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Playback Buttons */}
            <div className="mt-4 flex items-center justify-center lg:justify-between gap-4">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="True Shuffle"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isShuffled ? 'text-lime-300 bg-emerald-500/15' : 'text-[#9499A6] hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={playPrev}
                aria-label="Sebelumnya"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-white/[0.06]"
              >
                <SkipBack className="w-5 h-5 fill-current" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
                className="w-13 h-13 rounded-full bg-neon-gradient text-[#0B0B0F] flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-[0_0_28px_rgba(16,185,129,0.45)]"
              >
                {isBuffering ? (
                  <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2.2} />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-[#0B0B0F]" strokeWidth={2} />
                ) : (
                  <Play className="w-6 h-6 fill-[#0B0B0F] ml-0.5" strokeWidth={2} />
                )}
              </button>

              <button
                type="button"
                onClick={playNext}
                aria-label="Berikutnya"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-white/[0.06]"
              >
                <SkipForward className="w-5 h-5 fill-current" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={cycleLoopMode}
                aria-label="Loop"
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  loopMode !== 'off' ? 'text-lime-300 bg-emerald-500/15' : 'text-[#9499A6] hover:text-white'
                }`}
              >
                {loopMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Repeat className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Large Synced Lyrics with Progressive Blur */}
        <div className="lg:col-span-7 h-[42vh] lg:h-[72vh] rounded-3xl bg-white/[0.02] border border-white/[0.06] overflow-hidden backdrop-blur-sm">
          <SyncedLyricsList variant="zen" />
        </div>
      </div>
    </div>
  );
};
