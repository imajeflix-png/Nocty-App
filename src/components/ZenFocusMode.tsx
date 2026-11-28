import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Disc3,
  Film,
  Heart,
  Image as ImageIcon,
  ListOrdered,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useNetworkMode } from '../context/NetworkModeContext';
import { loadYouTubeIframeApi, usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { triggerHaptic } from '../utils/haptics';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { SyncedLyricsList } from './SyncedLyricsList';

type FocusViewMode = 'cover' | 'vinyl' | 'mv';

const FOCUS_VIEW_MODES: Array<{
  id: FocusViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { id: 'cover', label: 'Sampul', icon: ImageIcon },
  { id: 'vinyl', label: 'Vinyl', icon: Disc3 },
  { id: 'mv', label: 'Official MV', icon: Film },
];

export const ZenFocusMode: React.FC = () => {
  const { mode: networkMode, isAppInBackground, acceptNormalMode } = useNetworkMode();
  const {
    isZenMode,
    setIsZenMode,
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    isShuffled,
    isMoodShuffle,
    isMoodShuffleLoading,
    moodSessionProfile,
    loopMode,
    ambientPalette,
    queueTracks,
    currentMood,
    ambientVideoId,
    ambientVideoCandidates,
    selectAmbientVideoId,
    isResolvingAmbientVideo,
    setIsFocusMvActive,
    isAmbientVideoEnabled,
    playTrack,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    toggleShuffle,
    toggleMoodShuffle,
    cycleLoopMode,
    toggleLike,
    isLiked,
    removeFromQueue,
    clearUpcomingQueue,
    setActiveView,
    setIsStudioSheetOpen,
    resolvedTheme,
    isDynamicThemeSync,
    pushToast,
  } = usePlayer();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isMvPickerOpen, setIsMvPickerOpen] = useState(false);
  const [mvEmbedFailed, setMvEmbedFailed] = useState(false);
  const [focusViewMode, setFocusViewMode] = useState<FocusViewMode>('cover');
  const [showcaseDragX, setShowcaseDragX] = useState(0);
  const [isDraggingShowcase, setIsDraggingShowcase] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingDown, setIsDraggingDown] = useState(false);
  const [isClosingAnim, setIsClosingAnim] = useState(false);

  const seekRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const canSwipeDismissRef = useRef(false);
  const mvContainerRef = useRef<HTMLDivElement>(null);
  const mvPlayerRef = useRef<any>(null);
  const mvPlayerReadyRef = useRef(false);
  const failedMvIdsRef = useRef<Set<string>>(new Set());
  const lastMvSyncAtRef = useRef<number>(0);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const ambientVideoCandidatesRef = useRef(ambientVideoCandidates);
  ambientVideoCandidatesRef.current = ambientVideoCandidates;
  const selectAmbientVideoIdRef = useRef(selectAmbientVideoId);
  selectAmbientVideoIdRef.current = selectAmbientVideoId;

  const showcaseTouchRef = useRef<{
    startX: number;
    startY: number;
    axis: 'x' | 'y' | null;
  } | null>(null);

  useEffect(() => {
    setIsFocusMvActive(isZenMode && focusViewMode === 'mv');
  }, [focusViewMode, isZenMode, setIsFocusMvActive]);

  useEffect(() => {
    failedMvIdsRef.current.clear();
    setMvEmbedFailed(false);
    setIsMvPickerOpen(false);
  }, [currentTrack?.id]);

  useEffect(() => {
    setMvEmbedFailed(false);
  }, [ambientVideoId]);

  useEffect(() => {
    if (!isZenMode) {
      setIsQueueOpen(false);
      setIsMvPickerOpen(false);
      setDragOffsetY(0);
      setIsDraggingDown(false);
      setIsClosingAnim(false);
      setShowcaseDragX(0);
      setIsDraggingShowcase(false);
      touchStartYRef.current = null;
      canSwipeDismissRef.current = false;
      showcaseTouchRef.current = null;
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMvPickerOpen) {
          setIsMvPickerOpen(false);
        } else if (isQueueOpen) {
          setIsQueueOpen(false);
        } else {
          setIsZenMode(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMvPickerOpen, isQueueOpen, isZenMode, setIsZenMode]);

  const wantsMvBackdrop = focusViewMode === 'mv' || isAmbientVideoEnabled;
  const isAmbientVideoShowing =
    isZenMode &&
    wantsMvBackdrop &&
    networkMode === 'normal' &&
    !isAppInBackground &&
    Boolean(ambientVideoId) &&
    currentTrack?.sourceType !== 'local' &&
    !mvEmbedFailed;

  // Mount & sync YouTube IFrame Player API for Official MV background (muted, start-synced, play/pause-synced)
  useEffect(() => {
    const container = mvContainerRef.current;
    if (!isAmbientVideoShowing || !ambientVideoId || !container) {
      mvPlayerReadyRef.current = false;
      if (mvPlayerRef.current) {
        try {
          mvPlayerRef.current.destroy();
        } catch {
          // Ignore destroy failure
        }
        mvPlayerRef.current = null;
      }
      if (container) container.innerHTML = '';
      return;
    }

    let cancelled = false;
    mvPlayerReadyRef.current = false;
    container.innerHTML = '';
    const mountEl = document.createElement('div');
    mountEl.className = 'w-full h-full';
    container.appendChild(mountEl);

    loadYouTubeIframeApi().then(() => {
      if (cancelled || !window.YT?.Player || !container.contains(mountEl)) return;

      const startSec = Math.max(0, Math.floor(currentTimeRef.current));
      const player = new window.YT.Player(mountEl, {
        width: '100%',
        height: '100%',
        videoId: ambientVideoId,
        playerVars: {
          autoplay: isPlayingRef.current ? 1 : 0,
          mute: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          loop: 1,
          playlist: ambientVideoId,
          start: startSec,
        },
        events: {
          onReady: (ev) => {
            if (cancelled) return;
            mvPlayerReadyRef.current = true;
            try {
              ev.target.mute();
              const targetSec = Math.max(0, currentTimeRef.current);
              if (targetSec > 1) {
                ev.target.seekTo(targetSec, true);
              }
              if (isPlayingRef.current) {
                ev.target.playVideo();
              } else {
                ev.target.pauseVideo();
              }
            } catch {
              // Ignore YT ready sync error
            }
          },
          onStateChange: (ev) => {
            if (cancelled) return;
            try {
              ev.target.mute();
              if (ev.data === 0) {
                // Ended: loop cleanly
                ev.target.seekTo(0, true);
                if (isPlayingRef.current) ev.target.playVideo();
              }
            } catch {
              // Ignore state sync error
            }
          },
          onError: () => {
            if (cancelled) return;
            failedMvIdsRef.current.add(ambientVideoId);
            const nextCandidate = ambientVideoCandidatesRef.current.find(
              (c) => c.videoId && !failedMvIdsRef.current.has(c.videoId)
            );
            if (nextCandidate?.videoId) {
              selectAmbientVideoIdRef.current(nextCandidate.videoId);
              pushToast('Video klip utama dibatasi embed, beralih ke sumber MV lain...', 'info');
            } else {
              setMvEmbedFailed(true);
            }
          },
        },
      });

      mvPlayerRef.current = player;
    });

    return () => {
      cancelled = true;
      mvPlayerReadyRef.current = false;
      if (mvPlayerRef.current) {
        try {
          mvPlayerRef.current.destroy();
        } catch {
          // Ignore destroy failure
        }
        mvPlayerRef.current = null;
      }
      container.innerHTML = '';
    };
  }, [ambientVideoId, isAmbientVideoShowing, pushToast]);

  // Sync Play/Pause immediately with main audio
  useEffect(() => {
    const player = mvPlayerRef.current;
    if (!isAmbientVideoShowing || !mvPlayerReadyRef.current || !player) return;
    try {
      player.mute();
      if (isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    } catch {
      // Ignore YT control call failure
    }
  }, [isPlaying, isAmbientVideoShowing]);

  // Sync video timestamp when audio jumps/seeks (> 2.5s drift)
  useEffect(() => {
    const player = mvPlayerRef.current;
    if (!isAmbientVideoShowing || !mvPlayerReadyRef.current || !player) return;
    const now = Date.now();
    if (now - lastMvSyncAtRef.current < 1200) return;

    try {
      const mvSec = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      if (Number.isFinite(mvSec) && Math.abs(mvSec - currentTime) > 2.5) {
        lastMvSyncAtRef.current = now;
        player.seekTo(Math.max(0, currentTime), true);
      }
    } catch {
      // Ignore seek sync failure
    }
  }, [currentTime, isAmbientVideoShowing]);

  if (!isZenMode) return null;

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const liked = currentTrack ? isLiked(currentTrack.id) : false;
  const { primary, secondary, gradientIntensity } = ambientPalette;
  const accentStyleColor = isDynamicThemeSync ? primary.hex : undefined;

  const selectFocusMode = (nextMode: FocusViewMode) => {
    if (nextMode === focusViewMode) return;
    triggerHaptic(12);
    setFocusViewMode(nextMode);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isQueueOpen || isClosingAnim) return;
    if ((e.target as HTMLElement | null)?.closest('[data-focus-showcase="true"]')) {
      canSwipeDismissRef.current = false;
      return;
    }
    const outerTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (outerTop > 2) {
      canSwipeDismissRef.current = false;
      return;
    }

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

  const handleShowcaseTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    showcaseTouchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      axis: null,
    };
  };

  const handleShowcaseTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = showcaseTouchRef.current;
    if (!state || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - state.startX;
    const dy = e.touches[0].clientY - state.startY;

    if (!state.axis) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        state.axis = 'x';
        setIsDraggingShowcase(true);
      } else if (Math.abs(dy) > 10) {
        state.axis = 'y';
      }
    }

    if (state.axis === 'x') {
      e.stopPropagation();
      const clamped = Math.max(-110, Math.min(110, dx * 0.65));
      setShowcaseDragX(clamped);
    }
  };

  const handleShowcaseTouchEnd = () => {
    const state = showcaseTouchRef.current;
    showcaseTouchRef.current = null;
    setIsDraggingShowcase(false);

    if (state?.axis === 'x') {
      const currentIdx = FOCUS_VIEW_MODES.findIndex((m) => m.id === focusViewMode);
      if (showcaseDragX <= -36 && currentIdx < FOCUS_VIEW_MODES.length - 1) {
        selectFocusMode(FOCUS_VIEW_MODES[currentIdx + 1].id);
      } else if (showcaseDragX >= 36 && currentIdx > 0) {
        selectFocusMode(FOCUS_VIEW_MODES[currentIdx - 1].id);
      }
    }
    setShowcaseDragX(0);
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
      {/* Internal Solid Base + Fullscreen Official Music Video OR Cover Ambient Glow */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${
          isAmbientVideoShowing ? 'bg-[#0B0B0D]' : 'bg-[#F2F4F8] dark:bg-[#0B0B0D]'
        }`}
      >
        {isAmbientVideoShowing && ambientVideoId ? (
          <>
            <div
              ref={mvContainerRef}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[177.78vh] h-[56.25vw] scale-[1.24] opacity-90 pointer-events-none [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-[#08080A]/92" />
          </>
        ) : (
          <div
            className="ambient-aura-layer absolute inset-0 blur-3xl transition-all duration-1000"
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
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
            Nocty
          </span>
          {networkMode === 'lite' && (
            <button
              type="button"
              onClick={acceptNormalMode}
              title="Mode Ringan Aktif — klik untuk kembali ke Mode Normal"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/30 text-amber-200 transition-colors whitespace-nowrap"
            >
              <WifiOff className="w-3 h-3 shrink-0" strokeWidth={2} />
              <span className="hidden sm:inline">Mode Ringan Aktif</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-nowrap justify-end">
          {/* Tombol Antrean */}
          <button
            type="button"
            onClick={() => setIsQueueOpen(true)}
            aria-label="Antrean Pemutaran"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Antrean</span>
          </button>

          {/* Ikon Roda Gigi Settings (Apple Liquid Glass) */}
          <button
            type="button"
            onClick={() => {
              setIsZenMode(false);
              setActiveView('settings');
            }}
            aria-label="Pengaturan Nocty"
            title="Pengaturan"
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22)] flex items-center justify-center text-white/85 hover:text-white transition-colors shrink-0"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={1.9} />
          </button>

          {/* Minimize Now Playing */}
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

      {/* Quick Corner Action: Ganti Sumber MV when Official MV mode is active */}
      {focusViewMode === 'mv' &&
        currentTrack?.sourceType !== 'local' &&
        networkMode === 'normal' && (
          <button
            type="button"
            onClick={() => setIsMvPickerOpen(true)}
            className="absolute top-[74px] right-4 sm:right-8 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xl border border-white/15 text-[11px] font-medium text-white shadow-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" strokeWidth={2} />
            <span>Ganti Sumber MV</span>
          </button>
        )}

      {/* Single Scrollable Vertical Layout: Mode Switcher + Swipeable Showcase -> Title/Artist -> Progress & Controls -> Studio -> Lyrics */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6"
      >
        <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-5 pb-10">
          {/* Mode Indicator Pills: Sampul • Vinyl • Official MV */}
          <div
            role="tablist"
            aria-label="Mode tampilan pemutar"
            className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16)]"
          >
            {FOCUS_VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const selected = focusViewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectFocusMode(mode.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 whitespace-nowrap ${
                    selected
                      ? 'bg-white text-[#0B0B0D] shadow-sm'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" strokeWidth={2} />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. Swipeable Showcase Stage (Geser Kiri/Kanan) */}
          <div
            data-focus-showcase="true"
            onTouchStart={handleShowcaseTouchStart}
            onTouchMove={handleShowcaseTouchMove}
            onTouchEnd={handleShowcaseTouchEnd}
            onTouchCancel={handleShowcaseTouchEnd}
            style={{
              transform: showcaseDragX !== 0 ? `translateX(${showcaseDragX}px)` : undefined,
            }}
            className={`relative shrink-0 touch-pan-y select-none ${
              !isDraggingShowcase ? 'transition-transform duration-300 ease-out' : ''
            }`}
          >
            {focusViewMode === 'cover' && (
              <div className="relative pt-1">
                <div
                  aria-hidden="true"
                  className="ambient-aura-layer absolute -inset-6 top-5 rounded-3xl blur-3xl transition-all duration-1000"
                  style={{
                    opacity: Math.min(0.65, gradientIntensity * 1.1),
                    background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85), rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.6), transparent 72%)`,
                  }}
                />
                <CoverArt
                  src={currentTrack?.coverUrl}
                  alt={currentTrack?.title || 'Nocty'}
                  sizeHint={networkMode === 'lite' ? 'sm' : 'lg'}
                  className="relative w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 shadow-[0_24px_60px_rgba(0,0,0,0.7)] ring-1 ring-white/12"
                  roundedClass="rounded-2xl"
                />
              </div>
            )}

            {focusViewMode === 'vinyl' && (
              <div className="on-artwork relative w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-3xl bg-gradient-to-br from-[#1C1D24] via-[#121318] to-[#0B0B0E] border border-white/15 shadow-[0_26px_65px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] p-4 flex items-center justify-center overflow-hidden">
                {/* Ambient Turntable Subtle Glow */}
                <div
                  aria-hidden="true"
                  className="ambient-aura-layer pointer-events-none absolute -inset-4 blur-2xl opacity-35"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.75), transparent 65%)`,
                  }}
                />

                {/* Metallic Platter Base */}
                <div className="relative w-[86%] h-[86%] rounded-full bg-gradient-to-br from-white/10 to-black/70 p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.85)] ring-1 ring-white/10 flex items-center justify-center">
                  {/* Rotating Vinyl Disc + Center Album Art Label */}
                  <div
                    className={`relative w-full h-full rounded-full flex items-center justify-center shadow-inner animate-disc-spin ${
                      isPlaying ? 'disc-running' : 'disc-paused'
                    }`}
                    style={{
                      background: `
                        radial-gradient(circle, rgba(20,20,24,0) 27%, rgba(255,255,255,0.06) 27.5%, rgba(15,15,18,0.96) 28.5%, rgba(12,12,15,0.98) 42%, rgba(255,255,255,0.05) 42.5%, rgba(14,14,17,0.98) 43.5%, rgba(10,10,13,0.98) 60%, rgba(255,255,255,0.045) 60.5%, rgba(12,12,15,0.98) 61.5%, rgba(10,10,13,0.99) 78%, rgba(255,255,255,0.04) 78.5%, rgba(12,12,14,1) 80%, #09090B 100%),
                        conic-gradient(from 40deg, rgba(255,255,255,0.14) 0deg, transparent 50deg, rgba(255,255,255,0.04) 140deg, transparent 210deg, rgba(255,255,255,0.12) 290deg, transparent 360deg)
                      `,
                    }}
                  >
                    {/* Center Label Ring + Album Cover */}
                    <div className="relative w-[42%] h-[42%] rounded-full p-1 bg-white/15 ring-1 ring-white/25 shadow-lg overflow-hidden">
                      <CoverArt
                        src={currentTrack?.coverUrl}
                        alt={currentTrack?.title || 'Vinyl Nocty'}
                        sizeHint={networkMode === 'lite' ? 'sm' : 'md'}
                        className="w-full h-full rounded-full"
                        roundedClass="rounded-full"
                      />
                    </div>
                  </div>

                  {/* Center Spindle Pin (stationary) */}
                  <div className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-gradient-to-b from-zinc-200 to-zinc-500 border border-black/60 shadow-md z-10" />
                </div>

                {/* Articulated Turntable Tonearm (Needle pivots onto vinyl when playing) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3.5 right-3.5 z-20 w-9 h-9 flex items-center justify-center"
                >
                  {/* Gimbal Base */}
                  <div className="relative w-8 h-8 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-900 border border-white/20 shadow-lg flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-b from-zinc-300 to-zinc-500 shadow-inner" />

                    {/* Pivoting Arm Assembly */}
                    <div
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 origin-[50%_0%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isPlaying ? 'rotate-[25deg]' : 'rotate-[-6deg]'
                      }`}
                    >
                      {/* Counterweight */}
                      <div className="w-3.5 h-4 -mt-5 mx-auto rounded-sm bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-500 border border-black/40 shadow" />
                      {/* Tonearm Tube */}
                      <div className="w-1.5 h-28 sm:h-36 lg:h-40 mx-auto rounded-full bg-gradient-to-r from-zinc-400 via-zinc-100 to-zinc-500 shadow-[2px_4px_10px_rgba(0,0,0,0.65)]" />
                      {/* Angled Headshell & Stylus Cartridge */}
                      <div className="w-3 h-6 -mt-1 mx-auto rotate-[16deg] rounded-sm bg-gradient-to-b from-zinc-800 to-black border border-white/20 shadow-md flex flex-col items-center justify-end pb-0.5">
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isPlaying ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]' : 'bg-white/30'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {focusViewMode === 'mv' && (
              <div className="on-artwork relative w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-5 text-center">
                {isAmbientVideoShowing ? (
                  <div className="w-full h-full flex flex-col items-center justify-end pb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-[11px] font-medium text-white/90">
                      <Film className="w-3 h-3" strokeWidth={2} />
                      <span>Official MV · Tanpa Suara</span>
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-full rounded-3xl bg-black/45 backdrop-blur-md border border-white/[0.14] flex flex-col items-center justify-center p-5">
                    <CoverArt
                      src={currentTrack?.coverUrl}
                      alt={currentTrack?.title || 'Official MV'}
                      sizeHint="md"
                      className="w-24 h-24 opacity-75 mb-3 shadow-lg ring-1 ring-white/15"
                      roundedClass="rounded-xl"
                    />
                    {isResolvingAmbientVideo ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-white/85">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.1} />
                        <span>Mencari Official Music Video...</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-xs text-white/75 leading-relaxed max-w-[220px]">
                          {currentTrack?.sourceType === 'local'
                            ? 'File MP3 lokal tidak memiliki video klip YouTube.'
                            : networkMode === 'lite'
                              ? 'Video nonaktif saat Mode Ringan hemat kuota aktif.'
                              : mvEmbedFailed
                                ? 'Video klip utama diblokir untuk embed. Coba pilih sumber MV lain.'
                                : 'Official Music Video resmi belum ditemukan untuk lagu ini.'}
                        </p>
                        {ambientVideoCandidates.length > 0 && networkMode === 'normal' && (
                          <button
                            type="button"
                            onClick={() => setIsMvPickerOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-[11px] font-semibold text-white transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" strokeWidth={2} />
                            <span>Ganti Sumber MV</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtle Swipe Hint */}
          <div className="flex items-center gap-1.5 -mt-2" aria-hidden="true">
            {FOCUS_VIEW_MODES.map((m) => (
              <span
                key={m.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  focusViewMode === m.id ? 'w-5 bg-white/90' : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
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
              {isMoodShuffle && moodSessionProfile && (
                <p className="mt-1 text-xs text-white/75 flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3 h-3 shrink-0" strokeWidth={2} />
                  <span>
                    Mood Shuffle: {moodSessionProfile.moodProfile} ·{' '}
                    <span className="font-mono-tabular">{moodSessionProfile.tempoBpm} BPM</span>
                  </span>
                </p>
              )}
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

            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <button
                type="button"
                onClick={toggleMoodShuffle}
                aria-label="Mood Shuffle (Gemini AI)"
                aria-pressed={isMoodShuffle}
                title="Mood Shuffle — analisis energi & tempo via Gemini"
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isMoodShuffle
                    ? 'bg-white text-[#0B0B0D]'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {isMoodShuffleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Sparkles className="w-4 h-4" strokeWidth={1.85} />
                )}
              </button>

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

          {/* 4. Satu Pintu Akses Apple Liquid Glass: ✦ Nocty Studio */}
          <div className="w-full max-w-md flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setIsStudioSheetOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-white/[0.10] hover:bg-white/[0.17] backdrop-blur-xl border border-white/[0.22] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.32),0_10px_28px_rgba(0,0,0,0.35)] text-xs sm:text-sm font-semibold text-white tracking-tight transition-all active:scale-95 whitespace-nowrap"
            >
              <span aria-hidden="true" className="text-white/90">
                ✦
              </span>
              <span>Nocty Studio</span>
            </button>
          </div>

          {/* 5. Open Synced Lyrics Box Directly Below (with -0.5s / +0.5s offset controls) */}
          <div className="w-full h-[360px] sm:h-[400px] rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/[0.10] overflow-hidden flex flex-col">
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
            className="relative w-full sm:max-w-lg h-[78vh] sm:h-[74vh] rounded-t-3xl sm:rounded-3xl bg-[#121216]/95 backdrop-blur-md border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col"
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

      {/* MV Source Picker Overlay (opened via 'Ganti Sumber MV') */}
      {isMvPickerOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setIsMvPickerOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pilih Sumber Official MV"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[72vh] rounded-t-3xl sm:rounded-3xl bg-[#121216]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.08] shrink-0">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Ganti Sumber MV
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Pilih video klip alternatif jika video utama diblokir embed
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMvPickerOpen(false)}
                aria-label="Tutup pilihan sumber MV"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/16 flex items-center justify-center text-white/75 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.9} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
              {isResolvingAmbientVideo ? (
                <div className="py-10 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  <span>Memuat daftar kandidat Official MV...</span>
                </div>
              ) : ambientVideoCandidates.length === 0 ? (
                <div className="py-10 text-center px-4">
                  <p className="text-sm text-zinc-300">Belum ada kandidat video klip yang lolos filter.</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Audio/Static/Lyrics/Topic otomatis disaring agar hanya video klip bergerak yang tampil.
                  </p>
                </div>
              ) : (
                ambientVideoCandidates.map((cand) => {
                  const selected = cand.videoId === ambientVideoId;
                  return (
                    <button
                      key={cand.videoId || cand.id}
                      type="button"
                      onClick={() => {
                        if (!cand.videoId) return;
                        triggerHaptic(12);
                        setMvEmbedFailed(false);
                        selectAmbientVideoId(cand.videoId);
                        setIsMvPickerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-colors ${
                        selected
                          ? 'bg-white/12 border border-white/20'
                          : 'hover:bg-white/[0.06] border border-transparent'
                      }`}
                    >
                      <CoverArt
                        src={cand.coverUrl}
                        alt={cand.rawTitle || cand.title}
                        className="w-16 h-10 shrink-0"
                        roundedClass="rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white line-clamp-1">
                          {cand.rawTitle || cand.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {cand.channelName || cand.artist} ·{' '}
                          <span className="font-mono-tabular">{formatDuration(cand.duration)}</span>
                        </p>
                      </div>
                      {selected && (
                        <span className="w-6 h-6 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
