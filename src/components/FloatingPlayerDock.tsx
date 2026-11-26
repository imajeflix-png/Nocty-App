import React, { useRef, useState } from 'react';
import {
  Heart,
  ListOrdered,
  Loader2,
  Maximize2,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';

export const FloatingPlayerDock: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    loopMode,
    rightPanelTab,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleLoopMode,
    toggleLike,
    isLiked,
    toggleRightPanelTab,
    setIsZenMode,
  } = usePlayer();

  const seekBarRef = useRef<HTMLDivElement>(null);
  const [hoverSeekRatio, setHoverSeekRatio] = useState<number | null>(null);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  const computeSeekFromPointer = (clientX: number) => {
    if (!seekBarRef.current || duration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  };

  return (
    <div
      className={`fixed bottom-16 lg:bottom-4 left-3 right-3 lg:left-[272px] z-30 pointer-events-none transition-[right] duration-200 ${
        rightPanelTab ? 'lg:right-4 xl:right-[336px] 2xl:right-[356px]' : 'lg:right-4'
      }`}
    >
      <div className="pointer-events-auto mx-auto max-w-6xl rounded-2xl bg-[#121218]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_18px_50px_rgba(0,0,0,0.65)] px-3.5 py-2.5 sm:px-5 sm:py-3">
        {/* Interactive Top Edge / Hover-Expanding Progress Bar */}
        <div
          ref={seekBarRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek posisi lagu"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          onClick={(e) => computeSeekFromPointer(e.clientX)}
          onMouseMove={(e) => {
            if (!seekBarRef.current) return;
            const rect = seekBarRef.current.getBoundingClientRect();
            setHoverSeekRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
          }}
          onMouseLeave={() => setHoverSeekRatio(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') seekTo(currentTime + 5);
            if (e.key === 'ArrowLeft') seekTo(currentTime - 5);
          }}
          className="group relative -mt-1 mb-2.5 pt-1 pb-1.5 cursor-pointer select-none focus-visible:outline-none"
        >
          <div className="relative h-1 group-hover:h-2 transition-all duration-150 rounded-full bg-white/[0.1] overflow-hidden">
            {hoverSeekRatio !== null && (
              <div
                className="absolute inset-y-0 left-0 bg-white/[0.15] rounded-full pointer-events-none"
                style={{ width: `${hoverSeekRatio * 100}%` }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0 bg-neon-gradient rounded-full transition-[width] duration-75"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(163,230,53,0.9)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progressRatio * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 sm:gap-5">
          {/* Left: Rotating Disc Cover + Equalizer + Track Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial sm:w-[30%]">
            <CoverArt
              src={currentTrack?.coverUrl}
              alt={currentTrack?.title || 'Nocty'}
              spinning={true}
              isPlaying={isPlaying}
              className="w-11 h-11 sm:w-12 sm:h-12 ring-1 ring-white/15 shadow-lg"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {currentTrack ? currentTrack.title : 'Nocty Siap'}
                </p>
                {currentTrack && isPlaying && <EqualizerBars active={true} />}
              </div>
              <p className="text-xs text-[#9499A6] truncate">
                {currentTrack
                  ? `${currentTrack.artist}${currentTrack.isPreview ? ' · Preview 30d' : ''}`
                  : 'Pilih lagu untuk mulai mendengarkan'}
              </p>
            </div>

            {currentTrack && (
              <button
                type="button"
                onClick={() => toggleLike(currentTrack)}
                aria-label={liked ? 'Hapus dari disukai' : 'Sukai lagu ini'}
                className={`hidden sm:flex w-9 h-9 rounded-lg items-center justify-center transition-colors shrink-0 ${
                  liked ? 'text-lime-300' : 'text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-lime-300' : ''}`} strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Center: Transport Controls + Tabular Timestamps */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleShuffle}
              aria-label="True Shuffle (Fisher-Yates)"
              title="True Shuffle (Fisher-Yates)"
              className={`hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-colors ${
                isShuffled
                  ? 'text-lime-300 bg-emerald-500/15'
                  : 'text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Shuffle className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={playPrev}
              aria-label="Lagu sebelumnya"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#D4D7DF] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <SkipBack className="w-4 h-4 fill-current" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Jeda' : 'Putar'}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-neon-gradient text-[#0B0B0F] flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-[0_0_24px_rgba(16,185,129,0.4)] shrink-0"
            >
              {isBuffering ? (
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-[#0B0B0F]" strokeWidth={2} />
              ) : (
                <Play className="w-5 h-5 fill-[#0B0B0F] ml-0.5" strokeWidth={2} />
              )}
            </button>

            <button
              type="button"
              onClick={playNext}
              aria-label="Lagu berikutnya"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#D4D7DF] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <SkipForward className="w-4 h-4 fill-current" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={cycleLoopMode}
              aria-label={`Loop: ${loopMode}`}
              title={`Loop: ${loopMode}`}
              className={`hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-colors ${
                loopMode !== 'off'
                  ? 'text-lime-300 bg-emerald-500/15'
                  : 'text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {loopMode === 'one' ? (
                <Repeat1 className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Repeat className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>

            <span className="hidden md:inline-block ml-2 font-mono-tabular text-xs text-[#9499A6] whitespace-nowrap">
              {formatDuration(currentTime)} <span className="text-[#5B6070]">/</span>{' '}
              {formatDuration(duration)}
            </span>
          </div>

          {/* Right: Volume, Queue/Lyrics Toggles & Zen Focus Mode */}
          <div className="hidden sm:flex items-center justify-end gap-1.5 sm:w-[30%] shrink-0">
            <div className="hidden md:flex items-center gap-2 mr-1">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Bunyikan suara' : 'Bisukan suara'}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9499A6] hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" strokeWidth={1.75} />
                ) : (
                  <Volume2 className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Kontrol volume"
                className="w-20 accent-emerald-400 cursor-pointer h-1 bg-white/15 rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={() => toggleRightPanelTab('queue')}
              aria-label="Toggle panel antrean"
              title="Antrean"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                rightPanelTab === 'queue'
                  ? 'text-lime-300 bg-emerald-500/15'
                  : 'text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={() => toggleRightPanelTab('lyrics')}
              aria-label="Toggle panel lirik"
              title="Lirik Sinkron"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                rightPanelTab === 'lyrics'
                  ? 'text-lime-300 bg-emerald-500/15'
                  : 'text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Mic2 className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={() => setIsZenMode(true)}
              aria-label="Zen / Focus Mode"
              title="Zen / Focus Mode"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#9499A6] hover:text-lime-300 hover:bg-emerald-500/10 transition-colors"
            >
              <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Mobile Compact Zen Trigger */}
          <button
            type="button"
            onClick={() => setIsZenMode(true)}
            aria-label="Buka Zen Mode"
            className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[#9499A6] hover:text-lime-300"
          >
            <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
};
