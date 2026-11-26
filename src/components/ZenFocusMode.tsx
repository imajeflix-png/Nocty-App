import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  ChevronDown,
  Heart,
  ListOrdered,
  Loader2,
  Moon,
  Palette,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { SyncedLyricsList } from './SyncedLyricsList';

const SLEEP_PRESET_MINUTES = [15, 30, 60] as const;

function formatSleepCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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
    ambientPalette,
    queueTracks,
    currentMood,
    ambientVideoId,
    isAmbientVideoEnabled,
    toggleAmbientVideo,
    crossfadeDuration,
    cycleCrossfadeDuration,
    playTrack,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    toggleShuffle,
    cycleLoopMode,
    toggleLike,
    isLiked,
    removeFromQueue,
    clearUpcomingQueue,
    setIsTwinModalOpen,
    setIsWhisperComposerOpen,
    setIsLyricCardOpen,
    sleepTimerRemaining,
    sleepTimerMode,
    setSleepTimerMinutes,
    setSleepTimerEndOfTrack,
    cancelSleepTimer,
    resolvedTheme,
    isDynamicThemeSync,
    toggleDynamicThemeSync,
  } = usePlayer();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isSleepMenuOpen, setIsSleepMenuOpen] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingDown, setIsDraggingDown] = useState(false);
  const [isClosingAnim, setIsClosingAnim] = useState(false);
  const seekRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const canSwipeDismissRef = useRef(false);

  useEffect(() => {
    if (!isZenMode) {
      setIsQueueOpen(false);
      setIsSleepMenuOpen(false);
      setDragOffsetY(0);
      setIsDraggingDown(false);
      setIsClosingAnim(false);
      touchStartYRef.current = null;
      canSwipeDismissRef.current = false;
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSleepMenuOpen) {
          setIsSleepMenuOpen(false);
        } else if (isQueueOpen) {
          setIsQueueOpen(false);
        } else {
          setIsZenMode(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isQueueOpen, isSleepMenuOpen, isZenMode, setIsZenMode]);

  if (!isZenMode) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const liked = currentTrack ? isLiked(currentTrack.id) : false;
  const isSleepActive = sleepTimerMode !== 'off';
  const { primary, secondary, gradientIntensity } = ambientPalette;
  const accentStyleColor = isDynamicThemeSync ? primary.hex : undefined;
  const isAmbientVideoShowing =
    isAmbientVideoEnabled &&
    Boolean(ambientVideoId) &&
    currentTrack?.sourceType !== 'local';

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isQueueOpen || isSleepMenuOpen || isClosingAnim) return;
    const outerTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (outerTop > 2) {
      canSwipeDismissRef.current = false;
      return;
    }

    // Do not hijack scroll when user is scrolling inside a scrolled nested container (e.g. lyrics box)
    let node = e.target as HTMLElement | null;
    while (node && node !== e.currentTarget) {
      if (node !== scrollContainerRef.current && node.scrollHeight > node.clientHeight + 4 && node.scrollTop > 2) {
        canSwipeDismissRef.current = false;
        return;
      }
      node = node.parentElement;
    }

    touchStartYRef.current = e.touches[0].clientY;
    canSwipeDismissRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canSwipeDismissRef.current || touchStartYRef.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    if (deltaY > 0) {
      setIsDraggingDown(true);
      setDragOffsetY(deltaY);
    } else if (deltaY < -6) {
      canSwipeDismissRef.current = false;
      touchStartYRef.current = null;
      setIsDraggingDown(false);
      setDragOffsetY(0);
    }
  };

  const handleTouchEnd = () => {
    if (!canSwipeDismissRef.current) {
      touchStartYRef.current = null;
      return;
    }
    canSwipeDismissRef.current = false;
    touchStartYRef.current = null;
    setIsDraggingDown(false);

    if (dragOffsetY > 90) {
      setIsClosingAnim(true);
      window.setTimeout(() => {
        setIsZenMode(false);
        setIsClosingAnim(false);
        setDragOffsetY(0);
      }, 210);
    } else {
      setDragOffsetY(0);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: isClosingAnim
          ? 'translateY(100%)'
          : dragOffsetY > 0
            ? `translateY(${dragOffsetY}px)`
            : undefined,
      }}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden ${
        !isDraggingDown ? 'transition-transform duration-200 ease-out' : ''
      } ${
        isAmbientVideoShowing
          ? 'bg-[#0B0B0D] on-artwork'
          : 'bg-[#F2F4F8] dark:bg-[#0B0B0D]'
      }`}
    >
      {/* Internal Solid Base + Clear Spotify-Canvas-Style YouTube Music Video OR Cover Ambient Glow */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${
          isAmbientVideoShowing ? 'bg-[#0B0B0D]' : 'bg-[#F2F4F8] dark:bg-[#0B0B0D]'
        }`}
      >
        {isAmbientVideoShowing && ambientVideoId ? (
          <>
            <iframe
              key={`zen-mv-${ambientVideoId}`}
              title="Ambient Music Video Background"
              src={`https://www.youtube.com/embed/${ambientVideoId}?autoplay=1&mute=1&loop=1&playlist=${ambientVideoId}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`}
              allow="autoplay; encrypted-media; picture-in-picture"
              tabIndex={-1}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[177.78vh] h-[56.25vw] scale-115 opacity-75 pointer-events-none border-0"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-[#0B0B0D]" />
          </>
        ) : (
          <div
            className="absolute inset-0 blur-3xl transition-all duration-1000"
            style={{
              opacity:
                resolvedTheme === 'light'
                  ? Math.min(0.48, gradientIntensity * 0.85)
                  : Math.min(0.62, gradientIntensity),
              background: `
                radial-gradient(circle at 24% 38%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.95) 0%, transparent 58%),
                radial-gradient(circle at 76% 68%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.9) 0%, transparent 58%)
              `,
            }}
          />
        )}
      </div>

      {/* Top Swipe Handle Pill */}
      <div className="relative z-10 pt-2.5 pb-1 shrink-0 flex justify-center">
        <div className="w-10 h-1 rounded-full bg-white/30 mx-auto" />
      </div>

      {/* Slim Single-Row Compact Header */}
      <header className="relative z-10 flex items-center justify-between gap-2 px-4 sm:px-8 py-2 border-b border-white/[0.06] bg-black/25 backdrop-blur-md shrink-0">
        <span className="font-display text-base sm:text-lg font-bold tracking-tight text-white shrink-0">
          Nocty
        </span>

        <div className="flex items-center gap-1.5 flex-nowrap justify-end">
          <button
            type="button"
            onClick={toggleDynamicThemeSync}
            aria-pressed={isDynamicThemeSync}
            aria-label={isDynamicThemeSync ? 'Dynamic Theme Sync aktif' : 'Dynamic Theme Sync nonaktif'}
            title="Sinkronkan warna aksen UI dengan cover album"
            className="relative w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.10] flex items-center justify-center text-white transition-colors shrink-0"
            style={
              isDynamicThemeSync
                ? { borderColor: `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.55)` }
                : undefined
            }
          >
            <Palette className="w-3.5 h-3.5" strokeWidth={1.85} />
            {isDynamicThemeSync && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: primary.hex }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSleepMenuOpen((prev) => !prev)}
            aria-label="Sleep Timer"
            aria-expanded={isSleepMenuOpen}
            title="Atur Sleep Timer (15, 30, 60 menit)"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isSleepActive
                ? 'bg-white text-[#0B0B0D] border-white/20'
                : 'bg-white/[0.08] hover:bg-white/[0.14] border-white/[0.10] text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.85} />
            <span className="hidden sm:inline">Sleep</span>
            {isSleepActive && (
              <span className="font-mono-tabular text-[11px] opacity-85">
                {sleepTimerMode === 'countdown' && sleepTimerRemaining !== null
                  ? formatSleepCountdown(sleepTimerRemaining)
                  : 'Akhir'}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={cycleCrossfadeDuration}
            aria-label={`Cross-fade: ${crossfadeDuration > 0 ? `${crossfadeDuration} detik` : 'Mati'}`}
            title="Klik untuk mengubah durasi transisi cross-fade antar lagu"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <AudioLines className="w-3.5 h-3.5 text-white/75 shrink-0" strokeWidth={1.85} />
            <span className="text-white/85">Crossfade</span>
            <span className="font-mono-tabular text-[11px] text-white/65">
              {crossfadeDuration > 0 ? `${crossfadeDuration}d` : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={isAmbientVideoEnabled}
            aria-label="Ambient Video"
            onClick={toggleAmbientVideo}
            title={
              currentTrack?.sourceType === 'local'
                ? 'Ambient Video otomatis nonaktif untuk MP3 lokal'
                : 'Tampilkan video klip YouTube di latar belakang'
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span className="text-white/90 sm:hidden">Video</span>
            <span className="hidden sm:inline text-white/90">Ambient Video</span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors duration-200 ${
                isAmbientVideoEnabled ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full transition-transform duration-200 ${
                  isAmbientVideoEnabled
                    ? 'translate-x-3 bg-[#0B0B0D]'
                    : 'translate-x-0.5 bg-slate-500 dark:bg-white/80'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsQueueOpen(true)}
            aria-label="Antrean Pemutaran"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Antrean</span>
          </button>

          <button
            type="button"
            onClick={() => setIsZenMode(false)}
            aria-label="Tutup Now Playing"
            title="Tarik ke bawah atau ketuk untuk minimize"
            className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/18 border border-white/[0.10] flex items-center justify-center text-white transition-colors shrink-0"
          >
            <ChevronDown className="w-4 h-4 text-white/90" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Single Scrollable Vertical Layout: Cover -> Title/Artist -> Progress & Controls -> Social Row -> Synced Lyrics */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7"
      >
        <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-5 pb-10">
          {/* 1. Album Cover */}
          <div className="relative shrink-0 pt-1">
            <div
              aria-hidden="true"
              className="absolute -inset-6 top-5 rounded-3xl blur-3xl transition-all duration-1000"
              style={{
                opacity: Math.min(0.65, gradientIntensity * 1.1),
                background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85), rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.6), transparent 72%)`,
              }}
            />
            <CoverArt
              src={currentTrack?.coverUrl}
              alt={currentTrack?.title || 'Nocty'}
              className="relative w-52 h-52 sm:w-64 sm:h-64 lg:w-72 lg:h-72 shadow-[0_28px_70px_rgba(0,0,0,0.75)] ring-1 ring-white/12"
              roundedClass="rounded-2xl"
            />
          </div>

          {/* 2. Track Title, Artist & Like */}
          <div className="w-full max-w-md flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                  {currentTrack ? currentTrack.title : 'Belum Ada Lagu'}
                </h2>
                {currentTrack && isPlaying && (
                  <EqualizerBars active={true} barColor={accentStyleColor} />
                )}
              </div>
              <p className="mt-1 text-sm text-white/65 truncate">
                {currentTrack ? currentTrack.artist : 'Pilih lagu untuk mulai'}
              </p>
            </div>

            {currentTrack && (
              <button
                type="button"
                onClick={() => toggleLike(currentTrack)}
                aria-label="Sukai lagu"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  liked ? 'text-white' : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-white' : ''}`} strokeWidth={1.85} />
              </button>
            )}
          </div>

          {/* 3. Progress Bar & Main Controls */}
          <div className="w-full max-w-md space-y-4">
            <div>
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
                <div className="h-1.5 group-hover:h-2 transition-all rounded-full bg-white/18 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-[background-color] duration-300"
                    style={{
                      width: `${progress * 100}%`,
                      backgroundColor: accentStyleColor,
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between font-mono-tabular text-xs text-white/60">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="Smart Shuffle"
                title="Smart Shuffle (hindari artis sama & sesuai riwayat)"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isShuffled ? 'bg-white/18 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Shuffle className="w-4 h-4" strokeWidth={1.85} />
              </button>

              <button
                type="button"
                onClick={playPrev}
                aria-label="Sebelumnya"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipBack className="w-5 h-5 fill-current" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Jeda' : 'Putar'}
                className="w-14 h-14 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_8px_32px_rgba(255,255,255,0.25)]"
              >
                {isBuffering ? (
                  <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2.2} />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-[#0B0B0D]" strokeWidth={2} />
                ) : (
                  <Play className="w-6 h-6 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                )}
              </button>

              <button
                type="button"
                onClick={playNext}
                aria-label="Berikutnya"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-5 h-5 fill-current" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={cycleLoopMode}
                aria-label="Loop"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  loopMode !== 'off' ? 'bg-white/18 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {loopMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" strokeWidth={1.85} />
                ) : (
                  <Repeat className="w-4 h-4" strokeWidth={1.85} />
                )}
              </button>
            </div>
          </div>

          {/* 4. Aligned Social Action Row (Nocty Twin, Kirim Whisper, Kartu Lirik) */}
          {currentTrack && (
            <div className="w-full max-w-md flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsTwinModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <AppleEmoji unified="1f3a7" size={14} />
                <span>Nocty Twin</span>
              </button>
              <button
                type="button"
                onClick={() => setIsWhisperComposerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <AppleEmoji unified="2728" size={14} />
                <span>Kirim Whisper</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLyricCardOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.10] text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 text-white/80" strokeWidth={1.9} />
                <span>Kartu Lirik</span>
              </button>
            </div>
          )}

          {/* 5. Open Synced Lyrics Box Directly Below (with -0.5s / +0.5s offset controls) */}
          <div className="w-full h-[360px] sm:h-[400px] rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.10] overflow-hidden flex flex-col">
            <SyncedLyricsList variant="zen" hideActionButtons={true} />
          </div>
        </div>
      </div>

      {/* Queue Overlay (opened via Antrean button) */}
      {isQueueOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setIsQueueOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Antrean Pemutaran"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-lg h-[78vh] sm:h-[74vh] rounded-t-3xl sm:rounded-3xl bg-[#121216]/95 backdrop-blur-2xl border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex flex-col gap-2 px-5 py-3.5 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-base font-semibold text-white">
                    Antrean Pemutaran
                  </h2>
                  <span className="font-mono-tabular text-xs text-white/50">
                    {queueTracks.length} lagu
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {queueTracks.length > 0 && (
                    <button
                      type="button"
                      onClick={clearUpcomingQueue}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/16 border border-white/[0.08] text-xs font-medium text-white/85 hover:text-white transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.85} />
                      <span>Clear Queue</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsQueueOpen(false)}
                    aria-label="Tutup antrean"
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/16 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" strokeWidth={1.9} />
                  </button>
                </div>
              </div>

              {currentMood && (
                <div className="flex items-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.10] text-[11px] font-medium text-white/90">
                    <AppleEmoji unified={currentMood.emojiUnified} size={13} />
                    <span>{currentMood.badgeText}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-1">
              {queueTracks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                  <ListOrdered className="w-8 h-8 text-white/25 mb-3" strokeWidth={1.6} />
                  <p className="text-sm font-medium text-white/65">Antrean kosong</p>
                  <p className="text-xs text-white/40 mt-1">
                    Pilih lagu dari Home atau Explore untuk mulai memutar.
                  </p>
                </div>
              ) : (
                queueTracks.map((track, idx) => {
                  const active = currentTrack?.id === track.id;
                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      className={`group flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                        active ? 'bg-white/12' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playTrack(track)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <span className="w-5 text-center font-mono-tabular text-xs text-white/40 shrink-0">
                          {active && isPlaying ? (
                            <EqualizerBars active={true} className="h-3 mx-auto" />
                          ) : (
                            idx + 1
                          )}
                        </span>

                        <CoverArt
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-11 h-11 shrink-0"
                          roundedClass="rounded-lg"
                        />

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm truncate ${
                              active ? 'text-white font-semibold' : 'text-white/90 font-medium'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-white/55 truncate mt-0.5">{track.artist}</p>
                        </div>
                      </button>

                      <span className="font-mono-tabular text-xs text-white/45 shrink-0 hidden sm:inline">
                        {formatDuration(track.duration)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(idx);
                        }}
                        aria-label={`Hapus ${track.title} dari antrean`}
                        title="Hapus dari antrean"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white/45 hover:text-white hover:bg-white/12 transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" strokeWidth={1.9} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sleep Timer Modal / Popover inside Now Playing */}
      {isSleepMenuOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={() => setIsSleepMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pengaturan Sleep Timer"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xs rounded-2xl bg-[#121216]/92 backdrop-blur-2xl border border-white/[0.12] shadow-2xl p-4 space-y-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-white">Sleep Timer</h3>
                <p className="text-xs text-white/55 mt-0.5">
                  Hentikan pemutar musik otomatis saat durasi berakhir
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSleepMenuOpen(false)}
                aria-label="Tutup sleep timer"
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.9} />
              </button>
            </div>

            {isSleepActive && (
              <div className="rounded-xl bg-white/[0.07] border border-white/[0.09] px-3.5 py-2.5 flex items-center justify-between gap-3">
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
                    setIsSleepMenuOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
                >
                  Matikan
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {SLEEP_PRESET_MINUTES.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setSleepTimerMinutes(mins);
                    setIsSleepMenuOpen(false);
                  }}
                  className="py-2.5 px-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] border border-white/[0.09] text-xs font-medium text-white/90 hover:text-white transition-colors active:scale-[0.98] whitespace-nowrap"
                >
                  <span className="font-mono-tabular">{mins}</span> menit
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setSleepTimerEndOfTrack();
                setIsSleepMenuOpen(false);
              }}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-medium transition-colors whitespace-nowrap ${
                sleepTimerMode === 'end_of_track'
                  ? 'bg-white text-[#0B0B0D]'
                  : 'bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.09] text-white/85 hover:text-white'
              }`}
            >
              <span>Akhir lagu ini</span>
              {sleepTimerMode === 'end_of_track' && (
                <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.3} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
