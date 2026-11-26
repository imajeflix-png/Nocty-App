import React, { useState } from 'react';
import { Loader2, Pause, Play, RefreshCw, Shuffle } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { MOOD_CATEGORIES } from '../data/moods';
import { searchOnlineTracks } from '../services/pipedApi';
import { MoodCategory, Track } from '../types/music';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { TrackRow } from './TrackRow';

export const HomeView: React.FC = () => {
  const {
    indonesiaTrending,
    globalTrending,
    isTrendingLoading,
    trendingError,
    refreshTrending,
    currentTrack,
    isPlaying,
    playTrack,
    localTracks,
    toggleShuffle,
    isShuffled,
    pushToast,
    registerTracks,
  } = usePlayer();

  const [activeChart, setActiveChart] = useState<'id' | 'global'>('id');
  const [loadingMoodId, setLoadingMoodId] = useState<string | null>(null);
  const [activeMoodTitle, setActiveMoodTitle] = useState<string | null>(null);
  const [moodTracks, setMoodTracks] = useState<Track[]>([]);

  const heroTrack = currentTrack || indonesiaTrending[0] || globalTrending[0] || localTracks[0];
  const quickPicks = indonesiaTrending.slice(0, 6);
  const chartTracks = activeChart === 'id' ? indonesiaTrending : globalTrending;

  const handleMoodClick = async (mood: MoodCategory) => {
    setLoadingMoodId(mood.id);
    try {
      const { tracks } = await searchOnlineTracks(mood.query);
      if (tracks.length > 0) {
        registerTracks(tracks);
        setMoodTracks(tracks.slice(0, 12));
        setActiveMoodTitle(`Mix ${mood.label}`);
        playTrack(tracks[0], tracks);
      }
    } catch {
      pushToast(`Gagal memuat mix ${mood.label}. Coba lagi sebentar.`, 'error');
    } finally {
      setLoadingMoodId(null);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Bento Grid Top Section: Hero Card + 2x3 Quick Picks */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Hero Card (Featured Mix / Now Playing) */}
        <div className="xl:col-span-5 relative overflow-hidden rounded-2xl bg-[#121218]/90 border border-white/[0.08] p-6 flex flex-col justify-between min-h-[260px]">
          <div
            aria-hidden="true"
            className="absolute -right-14 -top-14 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(16,185,129,0.75) 0%, rgba(163,230,53,0.45) 55%, transparent 75%)',
            }}
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-emerald-400">
                {currentTrack ? 'Sedang Diputar di Nocty' : 'Pilihan Utama Nocty Hari Ini'}
              </p>
              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight line-clamp-2 text-balance">
                {heroTrack ? heroTrack.title : 'Nocty · Streaming Cepat Tanpa Batas'}
              </h1>
              <p className="mt-1.5 text-sm text-[#9499A6] truncate">
                {heroTrack
                  ? `${heroTrack.artist} · ${formatDuration(heroTrack.duration)}`
                  : 'Menyiapkan lagu populer terbaru...'}
              </p>
            </div>

            {heroTrack && (
              <CoverArt
                src={heroTrack.coverUrl}
                alt={heroTrack.title}
                className="w-20 h-20 sm:w-24 sm:h-24 shadow-2xl ring-1 ring-white/10"
                roundedClass="rounded-xl"
              />
            )}
          </div>

          <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!heroTrack}
              onClick={() => {
                if (heroTrack) {
                  playTrack(heroTrack, indonesiaTrending.length ? indonesiaTrending : [heroTrack]);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0B0B0F] bg-neon-gradient hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all shadow-[0_6px_24px_rgba(16,185,129,0.28)] whitespace-nowrap"
            >
              {currentTrack && heroTrack?.id === currentTrack.id && isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-[#0B0B0F]" strokeWidth={2} />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#0B0B0F]" strokeWidth={2} />
                  <span>Putar Sekarang</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={toggleShuffle}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${
                isShuffled
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-lime-300'
                  : 'border-white/[0.08] bg-white/[0.03] text-[#9499A6] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Shuffle className="w-4 h-4" strokeWidth={1.75} />
              <span>True Shuffle</span>
            </button>
          </div>
        </div>

        {/* Quick Picks (Compact 2x3 Grid) */}
        <div className="xl:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-white">Pilihan Cepat</h2>
            <button
              type="button"
              onClick={refreshTrending}
              disabled={isTrendingLoading}
              className="inline-flex items-center gap-1.5 text-xs text-[#9499A6] hover:text-lime-300 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isTrendingLoading ? 'animate-spin text-emerald-400' : ''}`}
                strokeWidth={1.75}
              />
              <span>Muat Ulang</span>
            </button>
          </div>

          {isTrendingLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[72px] rounded-xl bg-[#121218] border border-white/[0.06] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
              {quickPicks.map((track) => {
                const active = currentTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => playTrack(track, indonesiaTrending)}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all duration-200 ${
                      active
                        ? 'bg-emerald-500/[0.1] border-emerald-400/35 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                        : 'bg-[#121218]/90 border-white/[0.07] hover:bg-[#181822] hover:border-emerald-400/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                    }`}
                  >
                    <CoverArt
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-12 h-12"
                      roundedClass="rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${
                          active ? 'text-lime-300' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-[#9499A6] truncate mt-0.5">{track.artist}</p>
                    </div>
                    <span className="shrink-0 pr-1">
                      {active && isPlaying ? (
                        <EqualizerBars active={true} />
                      ) : (
                        <Play
                          className="w-4 h-4 text-lime-300 opacity-0 group-hover:opacity-100 transition-opacity fill-lime-300"
                          strokeWidth={1.75}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Mood & Vibe Bento Cards */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-white">Mood &amp; Vibe</h2>
          <span className="text-xs text-[#9499A6]">Pilih suasana untuk streaming otomatis</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {MOOD_CATEGORIES.map((mood) => {
            const isLoading = loadingMoodId === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                onClick={() => handleMoodClick(mood)}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121218] text-left aspect-[4/3] sm:aspect-[16/10] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <img
                  src={mood.coverUrl}
                  alt={mood.label}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0F] via-[#0B0B0F]/45 to-transparent" />
                <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                  <div className="flex justify-end">
                    <span className="w-9 h-9 rounded-full bg-[#0B0B0F]/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-lime-300 opacity-90 group-hover:bg-neon-gradient group-hover:text-[#0B0B0F] transition-colors">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                      ) : (
                        <Play className="w-4 h-4 fill-current" strokeWidth={1.75} />
                      )}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white">{mood.label}</h3>
                    <p className="text-xs text-[#C7CBD4] line-clamp-1 mt-0.5">{mood.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Mood Results (shown when a Mood card was clicked) */}
      {moodTracks.length > 0 && activeMoodTitle && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">{activeMoodTitle}</h2>
            <button
              type="button"
              onClick={() => {
                setMoodTracks([]);
                setActiveMoodTitle(null);
              }}
              className="text-xs text-[#9499A6] hover:text-white transition-colors"
            >
              Sembunyikan
            </button>
          </div>
          <div className="rounded-2xl bg-[#121218]/65 border border-white/[0.07] p-2">
            {moodTracks.map((track, idx) => (
              <TrackRow key={track.id} track={track} index={idx} contextTracks={moodTracks} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Lists: Top Hits Indonesia 2026 & Global Top Songs */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121218] border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setActiveChart('id')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeChart === 'id'
                  ? 'bg-neon-gradient text-[#0B0B0F] font-semibold'
                  : 'text-[#9499A6] hover:text-white'
              }`}
            >
              Top Hits Indonesia 2026
            </button>
            <button
              type="button"
              onClick={() => setActiveChart('global')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeChart === 'global'
                  ? 'bg-neon-gradient text-[#0B0B0F] font-semibold'
                  : 'text-[#9499A6] hover:text-white'
              }`}
            >
              Global Top Songs
            </button>
          </div>

          {trendingError && (
            <p className="text-xs text-amber-300/90">{trendingError}</p>
          )}
        </div>

        <div className="rounded-2xl bg-[#121218]/65 border border-white/[0.07] p-2 sm:p-3">
          {isTrendingLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : chartTracks.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-[#9499A6]">Belum ada daftar lagu yang termuat.</p>
              <button
                type="button"
                onClick={refreshTrending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0F] bg-neon-gradient"
              >
                Coba Muat Ulang
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {chartTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  contextTracks={chartTracks}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
