import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, Loader2, Pause, Play } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { MOOD_CATEGORIES } from '../data/moods';
import { searchOnlineTracks } from '../services/musicApi';
import { MoodCategory, Track } from '../types/music';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { TrackRow } from './TrackRow';

interface HorizontalShelfProps {
  title: string;
  tracks: Track[];
  isLoading: boolean;
}

const HorizontalTrackShelf: React.FC<HorizontalShelfProps> = ({ title, tracks, isLoading }) => {
  const { currentTrack, isPlaying, isBuffering, playTrack } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = direction === 'left' ? -440 : 440;
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
          {title}
        </h2>

        {!isLoading && tracks.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollByAmount('left')}
              aria-label={`Geser ${title} ke kiri`}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.08] flex items-center justify-center text-white/75 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('right')}
              aria-label={`Geser ${title} ke kanan`}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 border border-white/[0.08] flex items-center justify-center text-white/75 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-3.5 sm:gap-4 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 no-scrollbar">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="w-[148px] sm:w-[176px] lg:w-[184px] shrink-0 space-y-2.5">
              <div className="aspect-square w-full rounded-xl bg-white/[0.06] animate-pulse" />
              <div className="h-3.5 w-3/4 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-x-auto flex gap-3.5 sm:gap-4 -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 no-scrollbar snap-x snap-mandatory"
        >
          {tracks.map((track) => {
            const active = currentTrack?.id === track.id;
            const playingThis = active && isPlaying;
            const bufferingThis = active && isBuffering;

            return (
              <div
                key={track.id}
                role="button"
                tabIndex={0}
                onClick={() => playTrack(track, tracks)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playTrack(track, tracks);
                  }
                }}
                className="group w-[148px] sm:w-[176px] lg:w-[184px] shrink-0 snap-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg shadow-black/50">
                  <CoverArt
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                    roundedClass="rounded-xl"
                  />

                  <span
                    className={`absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all duration-200 ${
                      active
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                    }`}
                  >
                    {bufferingThis ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                    ) : playingThis ? (
                      <Pause className="w-4 h-4 fill-[#0B0B0D]" strokeWidth={2} />
                    ) : (
                      <Play className="w-4 h-4 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                    )}
                  </span>
                </div>

                <p className="mt-2.5 text-sm font-medium text-white truncate">{track.title}</p>
                <p className="text-xs text-white/55 truncate mt-0.5">{track.artist}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const HomeView: React.FC = () => {
  const {
    featuredTracks,
    indonesiaTrending,
    viralTracks,
    indieRnbTracks,
    isTrendingLoading,
    currentTrack,
    isPlaying,
    isBuffering,
    ambientPalette,
    playTrack,
    toggleLike,
    isLiked,
    pushToast,
    registerTracks,
  } = usePlayer();

  const [loadingMoodId, setLoadingMoodId] = useState<string | null>(null);
  const [activeMoodTitle, setActiveMoodTitle] = useState<string | null>(null);
  const [moodTracks, setMoodTracks] = useState<Track[]>([]);

  const heroPool = indonesiaTrending.length > 0 ? indonesiaTrending : featuredTracks;
  const heroTrack = heroPool[0] || null;
  const quickPicks = heroPool.slice(0, 6);
  const { primary, secondary } = ambientPalette;

  const isHeroActive = Boolean(heroTrack && currentTrack?.id === heroTrack.id);
  const isHeroPlaying = isHeroActive && isPlaying;
  const isHeroBuffering = isHeroActive && isBuffering;
  const isHeroLiked = heroTrack ? isLiked(heroTrack.id) : false;

  const handleMoodClick = async (mood: MoodCategory) => {
    setLoadingMoodId(mood.id);
    try {
      const { tracks } = await searchOnlineTracks(mood.query, undefined, 25);
      if (tracks.length > 0) {
        registerTracks(tracks);
        setMoodTracks(tracks.slice(0, 16));
        setActiveMoodTitle(`Mix ${mood.label}`);
        playTrack(tracks[0], tracks);
      }
    } catch {
      pushToast(`Tidak dapat memuat mix ${mood.label} saat ini.`, 'info');
    } finally {
      setLoadingMoodId(null);
    }
  };

  return (
    <div className="space-y-9 sm:space-y-11 pb-8">
      {/* Row 0: Sorotan Utama / Pilihan Editor Hero Spotlight */}
      <section className="space-y-4">
        <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight text-white text-balance">
          Sorotan Utama
        </h1>

        {isTrendingLoading || !heroTrack ? (
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-44 h-44 sm:w-48 sm:h-48 aspect-square rounded-xl bg-white/[0.06] animate-pulse shrink-0 mx-auto sm:mx-0" />
            <div className="flex-1 space-y-3">
              <div className="h-3.5 w-36 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-8 w-3/4 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-white/[0.05] animate-pulse" />
              <div className="h-10 w-40 rounded-full bg-white/[0.07] animate-pulse mt-4" />
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-white/[0.05] border border-white/[0.08] p-5 sm:p-7">
            {/* Soft Ambient Cover Glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -left-10 w-80 h-80 rounded-full blur-3xl opacity-30 transition-all duration-1000"
              style={{
                background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.95) 0%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.55) 45%, transparent 72%)`,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 right-0 w-72 h-72 rounded-full blur-3xl opacity-20 transition-all duration-1000"
              style={{
                background: `radial-gradient(circle, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.9) 0%, transparent 70%)`,
              }}
            />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
              <div className="relative shrink-0 mx-auto sm:mx-0">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-3 rounded-2xl blur-2xl opacity-35"
                  style={{
                    background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85), transparent 72%)`,
                  }}
                />
                <CoverArt
                  src={heroTrack.coverUrl}
                  alt={heroTrack.title}
                  className="relative w-44 h-44 sm:w-48 sm:h-48 lg:w-52 lg:h-52 shadow-[0_22px_54px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
                  roundedClass="rounded-xl"
                />
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs font-medium text-white/60">
                  Pilihan Editor <span aria-hidden="true">·</span> Puncak Tangga Lagu
                </p>

                <h2 className="mt-1.5 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white text-balance line-clamp-2">
                  {heroTrack.title}
                </h2>

                <p className="mt-1.5 text-sm sm:text-base text-white/65 truncate">
                  {heroTrack.artist}
                  {heroTrack.album && heroTrack.album !== 'Single' && (
                    <>
                      {' '}
                      <span aria-hidden="true">·</span> {heroTrack.album}
                    </>
                  )}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() => playTrack(heroTrack, heroPool)}
                    className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white text-[#0B0B0D] text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_8px_28px_rgba(255,255,255,0.22)] whitespace-nowrap"
                  >
                    {isHeroBuffering ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.3} />
                    ) : isHeroPlaying ? (
                      <Pause className="w-4 h-4 fill-[#0B0B0D]" strokeWidth={2} />
                    ) : (
                      <Play className="w-4 h-4 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                    )}
                    <span>
                      {isHeroBuffering ? 'Memuat...' : isHeroPlaying ? 'Jeda' : 'Putar Sekarang'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLike(heroTrack)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      isHeroLiked
                        ? 'bg-white/20 text-white border border-white/20'
                        : 'bg-white/10 hover:bg-white/15 text-white/85 hover:text-white border border-white/[0.08]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isHeroLiked ? 'fill-white' : ''}`} strokeWidth={1.9} />
                    <span>{isHeroLiked ? 'Disukai' : 'Sukai'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Row 1: Quick Picks Compact Tiles */}
      <section className="space-y-4">
        <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
          Putar Cepat
        </h2>

        {isTrendingLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {quickPicks.map((track) => {
              const active = currentTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => playTrack(track, quickPicks)}
                  className={`group flex items-center gap-3 pr-3 rounded-xl overflow-hidden text-left border transition-all duration-150 ${
                    active
                      ? 'bg-white/14 border-white/20'
                      : 'bg-white/[0.05] hover:bg-white/[0.09] border-white/[0.08]'
                  }`}
                >
                  <CoverArt
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-14 h-14 shrink-0"
                    roundedClass="rounded-none"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{track.title}</p>
                    <p className="text-xs text-white/55 truncate">{track.artist}</p>
                  </div>

                  <span className="shrink-0">
                    {active && isBuffering ? (
                      <span className="w-8 h-8 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center shadow-md">
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                      </span>
                    ) : active && isPlaying ? (
                      <EqualizerBars active={true} />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all shadow-md">
                        <Play className="w-3.5 h-3.5 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Row 2: Top Hits Indonesia (Borderless Square Carousel) */}
      <HorizontalTrackShelf
        title="Top Hits Indonesia"
        tracks={indonesiaTrending}
        isLoading={isTrendingLoading}
      />

      {/* Row 3: Global Top 50 (Borderless Square Carousel) */}
      <HorizontalTrackShelf
        title="Global Top 50"
        tracks={featuredTracks}
        isLoading={isTrendingLoading}
      />

      {/* Row 4: Viral & Trending (Borderless Square Carousel) */}
      <HorizontalTrackShelf
        title="Viral &amp; Trending"
        tracks={viralTracks}
        isLoading={isTrendingLoading}
      />

      {/* Row 5: Indie & R&B (Borderless Square Carousel) */}
      <HorizontalTrackShelf
        title="Indie &amp; R&amp;B"
        tracks={indieRnbTracks}
        isLoading={isTrendingLoading}
      />

      {/* Row 6: Horizontal Mood & Vibe Cards (Borderless Square Carousel) */}
      <section className="space-y-4">
        <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-white">
          Suasana &amp; Mood
        </h2>

        <div className="overflow-x-auto flex gap-3.5 sm:gap-4 -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 no-scrollbar snap-x snap-mandatory">
          {MOOD_CATEGORIES.map((mood) => {
            const isLoading = loadingMoodId === mood.id;
            return (
              <div
                key={mood.id}
                role="button"
                tabIndex={0}
                onClick={() => handleMoodClick(mood)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMoodClick(mood);
                  }
                }}
                className="group w-[148px] sm:w-[176px] lg:w-[184px] shrink-0 snap-start cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg shadow-black/50">
                  <img
                    src={mood.coverUrl}
                    alt={mood.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full aspect-square object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-white text-[#0B0B0D] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                    ) : (
                      <Play className="w-4 h-4 fill-[#0B0B0D] ml-0.5" strokeWidth={2} />
                    )}
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-medium text-white truncate">{mood.label}</p>
                <p className="text-xs text-white/55 truncate mt-0.5">{mood.subtitle}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Mood Mix Tracklist (when user clicks a mood) */}
      {moodTracks.length > 0 && activeMoodTitle && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">{activeMoodTitle}</h2>
            <button
              type="button"
              onClick={() => {
                setMoodTracks([]);
                setActiveMoodTitle(null);
              }}
              className="px-3 py-1 rounded-full text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/15 transition-colors"
            >
              Tutup
            </button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {moodTracks.map((track, idx) => (
              <TrackRow key={track.id} track={track} index={idx} contextTracks={moodTracks} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
