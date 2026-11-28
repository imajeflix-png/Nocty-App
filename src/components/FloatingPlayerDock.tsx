import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock,
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
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';

const SLEEP_PRESETS_MINUTES = [5, 10, 15, 30, 45, 60];

function formatSleepCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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
    isMoodShuffle,
    isMoodShuffleLoading,
    moodSessionProfile,
    loopMode,
    rightPanelTab,
    ambientPalette,
    isDynamicThemeSync,
    sleepTimerRemaining,
    sleepTimerMode,
    setSleepTimerMinutes,
    setSleepTimerEndOfTrack,
    cancelSleepTimer,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleMoodShuffle,
    cycleLoopMode,
    toggleLike,
    isLiked,
    toggleRightPanelTab,
    setIsZenMode,
  } = usePlayer();

  const seekBarRef = useRef<HTMLDivElement>(null);
  const [hoverSeekRatio, setHoverSeekRatio] = useState<number | null>(null);
  const [isSleepOverlayOpen, setIsSleepOverlayOpen] = useState(false);

  useEffect(() => {
    if (!isSleepOverlayOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSleepOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSleepOverlayOpen]);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const liked = currentTrack ? isLiked(currentTrack.id) : false;
  const { primary, secondary, gradientIntensity } = ambientPalette;
  const accentStyleColor = isDynamicThemeSync ? primary.hex : undefined;
  const isSleepActive = sleepTimerMode !== 'off';

  const computeSeekFromPointer = (clientX: number) => {
    if (!seekBarRef.current || duration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  };

  return (
    <>
      {/* Mobile Floating Glass Mini-Player cleanly floating above Floating Bubble Nav (< lg) */}
      <div className="lg:hidden fixed bottom-[92px] left-3 right-3 z-30">
        <div className="relative overflow-hidden rounded-3xl bg-white/[0.09] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.22] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_16px_38px_rgba(0,0,0,0.48)]">
          {/* Specular top glass edge highlight */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent z-20"
          />
          <div
            aria-hidden="true"
            className="ambient-aura-layer pointer-events-none absolute inset-0 blur-2xl transition-all duration-1000"
            style={{
              opacity: Math.min(0.45, gradientIntensity * 0.8),
              background: `linear-gradient(110deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.8), rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.7))`,
            }}
          />

          <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setIsZenMode(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
            >
              <CoverArt
                src={currentTrack?.coverUrl}
                alt={currentTrack?.title || 'Nocty'}
                className="w-10 h-10 shrink-0"
                roundedClass="rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {currentTrack ? currentTrack.title : 'Nocty Siap'}
                  </p>
                  {currentTrack && isPlaying && (
                    <EqualizerBars active={true} className="h-2.5" barColor={accentStyleColor} />
                  )}
                </div>
                <p className="text-[11px] text-white/60 truncate">
                  {currentTrack ? currentTrack.artist : 'Pilih lagu untuk mulai'}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              {currentTrack && (
                <button
                  type="button"
                  onClick={() => toggleLike(currentTrack)}
                  aria-label={liked ? 'Hapus dari disukai' : 'Sukai lagu'}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    liked ? 'text-white' : 'text-white/55 hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} strokeWidth={1.85} />
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleRightPanelTab('queue')}
                aria-label="Antrean Pemutaran"
                aria-pressed={rightPanelTab === 'queue'}
                title="Antrean"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  rightPanelTab === 'queue'
                    ? 'bg-white text-[#0B0B0D]'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                <ListOrdered className="w-4 h-4" strokeWidth={1.9} />
              </button>

              <button
                type="button"
                onClick={() => setIsSleepOverlayOpen((prev) => !prev)}
                aria-label="Sleep Timer"
                aria-expanded={isSleepOverlayOpen}
                aria-haspopup="dialog"
                title={
                  sleepTimerMode === 'countdown' && sleepTimerRemaining !== null
                    ? `Sleep Timer: ${formatSleepCountdown(sleepTimerRemaining)}`
                    : sleepTimerMode === 'end_of_track'
                      ? 'Sleep Timer: Akhir lagu'
                      : 'Sleep Timer'
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isSleepActive
                    ? 'bg-white text-[#0B0B0D]'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                <Clock className="w-4 h-4" strokeWidth={1.9} />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
                className="ml-0.5 w-9 h-9 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center active:scale-95 transition-transform shadow-md"
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.3} />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-[#0B0B0D]" strokeWidth={2} />
                ) : (
                  <Play className="w-4 h-4 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {/* Slim bottom edge progress line */}
          <div className="relative z-10 h-[2px] w-full bg-white/10">
            <div
              className="h-full bg-white transition-[width,background-color] duration-300"
              style={{
                width: `${progressRatio * 100}%`,
                backgroundColor: accentStyleColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Desktop Floating Apple iOS 26 Liquid Glass Player Bar */}
      <footer className="hidden lg:block px-3 pb-3 select-none">
        <div className="relative h-[82px] w-full rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_16px_44px_rgba(0,0,0,0.5)] px-5 flex items-center justify-between gap-4 overflow-hidden">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent z-20"
          />
          {/* Soft Dual-Color Ambient Aura behind Floating Glass Dock */}
          <div
            aria-hidden="true"
            className="ambient-aura-layer pointer-events-none absolute inset-0 blur-3xl transition-all duration-1000"
            style={{
              opacity: Math.min(0.52, gradientIntensity * 0.85),
              background: `
                radial-gradient(ellipse 40% 110% at 15% 50%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85) 0%, transparent 75%),
                radial-gradient(ellipse 40% 110% at 85% 50%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.75) 0%, transparent 75%)
              `,
            }}
          />

          {/* Left (30%): 52x52 Cover, Title, Artist (click to open Now Playing), Heart */}
          <div className="relative z-10 flex items-center gap-3 w-[30%] min-w-0">
            <button
              type="button"
              onClick={() => setIsZenMode(true)}
              aria-label="Buka layar Now Playing"
              className="group flex items-center gap-3.5 min-w-0 text-left rounded-xl p-1 -m-1 hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <CoverArt
                src={currentTrack?.coverUrl}
                alt={currentTrack?.title || 'Nocty'}
                className="w-[52px] h-[52px] shadow-lg shadow-black/50 group-hover:scale-[1.03] transition-transform"
                roundedClass="rounded-xl"
              />

              <div className="min-w-0 max-w-[200px]">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {currentTrack ? currentTrack.title : 'Nocty Siap'}
                  </p>
                  {currentTrack && isPlaying && (
                    <EqualizerBars active={true} className="h-3" barColor={accentStyleColor} />
                  )}
                </div>
                <p className="text-xs text-white/55 truncate mt-0.5">
                  {currentTrack
                    ? `${currentTrack.artist}${currentTrack.isPreview ? ' · Preview 30d' : ''}`
                    : 'Pilih lagu untuk diputar'}
                </p>
              </div>
            </button>

            {currentTrack && (
              <button
                type="button"
                onClick={() => toggleLike(currentTrack)}
                aria-label={liked ? 'Hapus dari disukai' : 'Sukai lagu ini'}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  liked ? 'text-white' : 'text-white/45 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} strokeWidth={1.85} />
              </button>
            )}
          </div>

          {/* Center (40%): Clean Transport Controls + Seek Bar */}
          <div className="relative z-10 flex flex-col items-center justify-center w-[40%] max-w-[600px]">
            <div className="flex items-center gap-2.5 mb-1.5">
              <button
                type="button"
                onClick={toggleMoodShuffle}
                aria-label="Mood Shuffle (Gemini AI)"
                aria-pressed={isMoodShuffle}
                title={
                  isMoodShuffle && moodSessionProfile
                    ? `Mood Shuffle: ${moodSessionProfile.moodProfile} (${moodSessionProfile.tempoBpm} BPM)`
                    : 'Mood Shuffle (filter lagu sesuai energi & tempo via Gemini)'
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isMoodShuffle
                    ? 'bg-white text-[#0B0B0D] shadow-sm'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                {isMoodShuffleLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.9} />
                )}
              </button>

              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="Smart Shuffle"
                title="Smart Shuffle (hindari artis sama & sesuai riwayat)"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isShuffled
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5" strokeWidth={1.9} />
              </button>

              <button
                type="button"
                onClick={playPrev}
                aria-label="Lagu sebelumnya"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipBack className="w-4 h-4 fill-current" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
                className="w-9 h-9 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_4px_18px_rgba(255,255,255,0.22)] shrink-0"
              >
                {isBuffering ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.4} />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-[#0B0B0D]" strokeWidth={2} />
                ) : (
                  <Play className="w-4 h-4 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                )}
              </button>

              <button
                type="button"
                onClick={playNext}
                aria-label="Lagu berikutnya"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-4 h-4 fill-current" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={cycleLoopMode}
                aria-label={`Loop: ${loopMode}`}
                title={`Loop: ${loopMode}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  loopMode !== 'off'
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                {loopMode === 'one' ? (
                  <Repeat1 className="w-3.5 h-3.5" strokeWidth={1.9} />
                ) : (
                  <Repeat className="w-3.5 h-3.5" strokeWidth={1.9} />
                )}
              </button>
            </div>

            <div className="w-full flex items-center gap-2.5">
              <span className="font-mono-tabular text-[11px] text-white/50 w-10 text-right">
                {formatDuration(currentTime)}
              </span>

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
                className="group relative flex-1 py-1.5 cursor-pointer focus-visible:outline-none"
              >
                <div className="relative h-1 group-hover:h-1.5 transition-all rounded-full bg-white/15 overflow-hidden">
                  {hoverSeekRatio !== null && (
                    <div
                      className="absolute inset-y-0 left-0 bg-white/20 rounded-full pointer-events-none"
                      style={{ width: `${hoverSeekRatio * 100}%` }}
                    />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 bg-white rounded-full transition-[width,background-color] duration-150"
                    style={{
                      width: `${progressRatio * 100}%`,
                      backgroundColor: accentStyleColor,
                    }}
                  />
                </div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    left: `${progressRatio * 100}%`,
                    backgroundColor: accentStyleColor,
                  }}
                />
              </div>

              <span className="font-mono-tabular text-[11px] text-white/50 w-10">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Right (30%): Secondary Glass Controls (Lyrics, Queue, Sleep Timer, Zen, Volume) */}
          <div className="relative z-10 flex items-center justify-end gap-1.5 w-[30%] shrink-0">
            <button
              type="button"
              onClick={() => toggleRightPanelTab('lyrics')}
              aria-label="Toggle panel lirik"
              title="Lirik Sinkron"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                rightPanelTab === 'lyrics'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 hover:bg-white/15 text-white/70 hover:text-white'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" strokeWidth={1.85} />
            </button>

            <button
              type="button"
              onClick={() => toggleRightPanelTab('queue')}
              aria-label="Toggle panel antrean"
              title="Antrean"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                rightPanelTab === 'queue'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 hover:bg-white/15 text-white/70 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.85} />
            </button>

            <button
              type="button"
              onClick={() => setIsSleepOverlayOpen((prev) => !prev)}
              aria-label="Sleep Timer"
              aria-expanded={isSleepOverlayOpen}
              aria-haspopup="dialog"
              title="Sleep Timer"
              className={`h-8 rounded-full flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isSleepActive
                  ? 'px-2.5 bg-white text-[#0B0B0D] font-semibold'
                  : 'w-8 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.95} />
              {sleepTimerMode === 'countdown' && sleepTimerRemaining !== null && (
                <span className="font-mono-tabular text-[11px] leading-none">
                  {formatSleepCountdown(sleepTimerRemaining)}
                </span>
              )}
              {sleepTimerMode === 'end_of_track' && (
                <span className="text-[11px] leading-none">Akhir</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsZenMode(true)}
              aria-label="Zen Mode (Fullscreen)"
              title="Now Playing"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-colors shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.85} />
            </button>

            <div className="flex items-center gap-1.5 ml-0.5 shrink-0">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Bunyikan suara' : 'Bisukan suara'}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-white/50" strokeWidth={1.85} />
                ) : (
                  <Volume2 className="w-4 h-4" strokeWidth={1.85} />
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
                style={accentStyleColor ? { accentColor: accentStyleColor } : undefined}
                className="w-20 xl:w-24 accent-white cursor-pointer h-1 bg-white/20 rounded-lg"
              />
            </div>
          </div>
        </div>
      </footer>

      {/* Sleep Timer Overlay */}
      {isSleepOverlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px]"
          onClick={() => setIsSleepOverlayOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pengaturan Sleep Timer"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-3 bottom-[156px] mx-auto max-w-[360px] lg:inset-x-auto lg:bottom-[100px] lg:right-4 lg:w-[320px] rounded-3xl bg-[#121216]/75 backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.20] shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_20px_50px_rgba(0,0,0,0.65)] p-4 overflow-hidden"
          >
            {/* Subtle cover-adaptive ambient tint */}
            <div
              aria-hidden="true"
              className="ambient-aura-layer pointer-events-none absolute -top-12 -right-10 w-44 h-44 rounded-full blur-3xl opacity-25"
              style={{
                background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9), rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.5), transparent 70%)`,
              }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-white">Sleep Timer</h3>
                  <p className="text-xs text-white/55 mt-0.5">
                    Jeda pemutaran otomatis saat waktu habis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSleepOverlayOpen(false)}
                  aria-label="Tutup sleep timer"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" strokeWidth={1.9} />
                </button>
              </div>

              {isSleepActive && (
                <div className="mt-3 rounded-xl bg-white/[0.07] border border-white/[0.09] px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/55">Timer aktif</p>
                    <p className="font-mono-tabular text-base font-semibold text-white leading-tight mt-0.5">
                      {sleepTimerMode === 'countdown' && sleepTimerRemaining !== null
                        ? formatSleepCountdown(sleepTimerRemaining)
                        : 'Akhir lagu ini'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      cancelSleepTimer();
                      setIsSleepOverlayOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Matikan
                  </button>
                </div>
              )}

              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {SLEEP_PRESETS_MINUTES.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setSleepTimerMinutes(mins);
                      setIsSleepOverlayOpen(false);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.08] text-xs font-medium text-white/90 hover:text-white transition-colors active:scale-[0.98] whitespace-nowrap"
                  >
                    <span className="font-mono-tabular">{mins}</span> menit
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSleepTimerEndOfTrack();
                  setIsSleepOverlayOpen(false);
                }}
                className={`w-full mt-2 py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-medium transition-colors whitespace-nowrap ${
                  sleepTimerMode === 'end_of_track'
                    ? 'bg-white text-[#0B0B0D]'
                    : 'bg-white/[0.06] hover:bg-white/[0.13] border border-white/[0.08] text-white/85 hover:text-white'
                }`}
              >
                <span>Akhir lagu ini</span>
                {sleepTimerMode === 'end_of_track' && (
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.3} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
