import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Disc3,
  Heart,
  ListOrdered,
  Loader2,
  Mic2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { SyncedLyricsList } from './SyncedLyricsList';

type NowPlayingTab = 'player' | 'lyrics' | 'queue';

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
    activeEngine,
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
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<NowPlayingTab>('player');
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
  const { primary, secondary } = ambientPalette;
  const isAmbientVideoShowing =
    isAmbientVideoEnabled &&
    isPlaying &&
    activeEngine === 'youtube' &&
    currentTrack?.sourceType !== 'local';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-700 ${
        isAmbientVideoShowing ? 'bg-[#0B0B0D]/20' : 'bg-[#0B0B0D]'
      }`}
    >
      {/* Dual-Color Cover-Adaptive Ambient Mesh Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none blur-3xl opacity-25 transition-all duration-1000"
        style={{
          background: `
            radial-gradient(circle at 24% 38%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.95) 0%, transparent 58%),
            radial-gradient(circle at 76% 68%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.9) 0%, transparent 58%)
          `,
        }}
      />

      {/* Top Bar */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-10 py-4 sm:py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-lg font-bold tracking-tight text-white">Nocty</span>
          <span className="text-xs text-white/30" aria-hidden="true">
            ·
          </span>
          <span className="text-xs text-white/55">Now Playing</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={cycleCrossfadeDuration}
            aria-label={`Cross-fade: ${crossfadeDuration > 0 ? `${crossfadeDuration} detik` : 'Mati'}`}
            title="Klik untuk mengubah durasi transisi cross-fade antar lagu"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <AudioLines className="w-3.5 h-3.5 text-white/75 shrink-0" strokeWidth={1.85} />
            <span className="hidden sm:inline text-white/85">Crossfade</span>
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
                : 'Tampilkan video musik redup di latar belakang'
            }
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span className="text-white/85">Ambient Video</span>
            <span className="font-mono-tabular text-[11px] text-white/65">
              {isAmbientVideoEnabled ? 'ON' : 'OFF'}
            </span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                isAmbientVideoEnabled ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full transition-transform duration-200 ${
                  isAmbientVideoEnabled
                    ? 'translate-x-3.5 bg-[#0B0B0D]'
                    : 'translate-x-0.5 bg-white/80'
                }`}
              />
            </span>
          </button>

          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveTab('player')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'player' ? 'bg-white text-[#0B0B0D]' : 'text-white/65 hover:text-white'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" strokeWidth={1.85} />
              <span>Pemutar</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab((prev) => (prev === 'lyrics' ? 'player' : 'lyrics'))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'lyrics' ? 'bg-white text-[#0B0B0D]' : 'text-white/65 hover:text-white'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" strokeWidth={1.85} />
              <span>Lirik</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab((prev) => (prev === 'queue' ? 'player' : 'queue'))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'queue' ? 'bg-white text-[#0B0B0D]' : 'text-white/65 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.85} />
              <span>Antrean</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsZenMode(false)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.08] text-xs font-medium text-white transition-colors whitespace-nowrap"
          >
            <Minimize2 className="w-4 h-4 text-white/80" strokeWidth={1.85} />
            <span className="hidden sm:inline">Tutup</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'player' ? (
        <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-5 sm:px-10 pb-8 overflow-y-auto">
          <div className="w-full max-w-md flex flex-col items-center">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-6 top-5 rounded-3xl blur-3xl opacity-35 transition-all duration-1000"
                style={{
                  background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85), rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.6), transparent 72%)`,
                }}
              />
              <CoverArt
                src={currentTrack?.coverUrl}
                alt={currentTrack?.title || 'Nocty'}
                className="relative w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 shadow-[0_28px_70px_rgba(0,0,0,0.75)] ring-1 ring-white/12"
                roundedClass="rounded-2xl"
              />
            </div>

            <div className="mt-7 w-full">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                      {currentTrack ? currentTrack.title : 'Belum Ada Lagu'}
                    </h2>
                    {currentTrack && isPlaying && <EqualizerBars active={true} />}
                  </div>
                  <p className="mt-1 text-sm text-white/60 truncate">
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
                  <div className="h-1.5 group-hover:h-2 transition-all rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between font-mono-tabular text-xs text-white/55">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Playback Buttons */}
              <div className="mt-4 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  aria-label="True Shuffle"
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isShuffled ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Shuffle className="w-4 h-4" strokeWidth={1.85} />
                </button>

                <button
                  type="button"
                  onClick={playPrev}
                  aria-label="Sebelumnya"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <SkipBack className="w-5 h-5 fill-current" strokeWidth={1.75} />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  className="w-14 h-14 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_8px_32px_rgba(255,255,255,0.22)]"
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
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <SkipForward className="w-5 h-5 fill-current" strokeWidth={1.75} />
                </button>

                <button
                  type="button"
                  onClick={cycleLoopMode}
                  aria-label="Loop"
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    loopMode !== 'off' ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white hover:bg-white/10'
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
          </div>
        </div>
      ) : (
        /* Full-Height Queue / Lyrics View with Compact 48x48 Horizontal Mini-Header */
        <div className="relative z-10 flex-1 min-h-0 max-w-3xl w-full mx-auto px-4 sm:px-8 pb-5 sm:pb-8 flex flex-col gap-3">
          {/* Compact Horizontal Mini-Header (48x48 cover + title + Play/Pause) */}
          <div className="relative overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shrink-0">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('player')}
                title="Kembali ke tampilan sampul penuh"
                className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl hover:bg-white/[0.04] p-1 -m-1 transition-colors"
              >
                <CoverArt
                  src={currentTrack?.coverUrl}
                  alt={currentTrack?.title || 'Nocty'}
                  className="w-12 h-12 shrink-0"
                  roundedClass="rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-display text-sm sm:text-base font-semibold text-white truncate">
                      {currentTrack ? currentTrack.title : 'Belum Ada Lagu'}
                    </p>
                    {currentTrack && isPlaying && <EqualizerBars active={true} className="h-3 shrink-0" />}
                  </div>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    {currentTrack ? currentTrack.artist : 'Pilih lagu untuk mulai'}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                {currentTrack && (
                  <button
                    type="button"
                    onClick={() => toggleLike(currentTrack)}
                    aria-label="Sukai lagu"
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      liked ? 'text-white' : 'text-white/55 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} strokeWidth={1.85} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={playNext}
                  aria-label="Lagu berikutnya"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <SkipForward className="w-4 h-4 fill-current" strokeWidth={1.8} />
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  aria-label={isPlaying ? 'Jeda' : 'Putar'}
                  className="w-10 h-10 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
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

            {/* Slim Interactive Progress Line */}
            <div
              onClick={(e) => {
                if (duration <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                seekTo(ratio * duration);
              }}
              className="h-1 w-full bg-white/10 cursor-pointer"
            >
              <div
                className="h-full bg-white transition-[width] duration-150"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          {/* Full Remaining Screen Area for Queue or Synced Lyrics */}
          <div className="flex-1 min-h-0 rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] overflow-hidden flex flex-col">
            {activeTab === 'lyrics' ? (
              <SyncedLyricsList variant="zen" />
            ) : (
              <>
                {/* Queue Header with Clear Queue button */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/[0.07] shrink-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-sm sm:text-base font-semibold text-white">
                      Antrean Pemutaran
                    </h2>
                    <span className="font-mono-tabular text-xs text-white/50">
                      {queueTracks.length} lagu
                    </span>
                  </div>

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
                </div>

                {/* Full-Height Queue List */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 space-y-1">
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
