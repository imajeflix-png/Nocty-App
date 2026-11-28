import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, History, Loader2, Search, Upload, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { searchOnlineTracks } from '../services/musicApi';
import { Track } from '../types/music';
import { TrackRow } from './TrackRow';

type CuratedChannelId = 'indonesia' | 'global' | 'viral' | 'indie-rnb' | 'kpop' | 'jpop';

interface CuratedChannel {
  id: CuratedChannelId;
  label: string;
  query?: string;
}

const CURATED_CHANNELS: CuratedChannel[] = [
  { id: 'indonesia', label: 'Top Hits Indonesia' },
  { id: 'global', label: 'Global Top 50' },
  { id: 'viral', label: 'Viral TikTok & Reels' },
  { id: 'indie-rnb', label: 'Indie & R&B' },
  { id: 'kpop', label: 'K-Pop Hits', query: 'NewJeans aespa BTS Jungkook BLACKPINK' },
  { id: 'jpop', label: 'J-Pop & Anime', query: 'YOASOBI Kenshi Yonezu Fujii Kaze Ado' },
];

export const ExploreView: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    onlineSearchResults,
    localSearchMatches,
    lyricLibraryMatches,
    isSearching,
    recentSearches,
    recordRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    indonesiaTrending,
    featuredTracks,
    viralTracks,
    indieRnbTracks,
    isTrendingLoading,
    registerTracks,
    uploadLocalFiles,
  } = usePlayer();

  const [activeChannel, setActiveChannel] = useState<CuratedChannelId>('indonesia');
  const [channelTracks, setChannelTracks] = useState<Track[]>([]);
  const [isChannelLoading, setIsChannelLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectRecentSearch = useCallback(
    (term: string) => {
      setSearchQuery(term);
      recordRecentSearch(term);
    },
    [recordRecentSearch, setSearchQuery]
  );

  const handleRemoveRecentSearch = useCallback(
    (term: string) => {
      removeRecentSearch(term);
    },
    [removeRecentSearch]
  );

  const handleClearRecentSearches = useCallback(() => {
    clearRecentSearches();
  }, [clearRecentSearches]);

  // Dynamic Curated Browse Feed when Search Input is empty
  useEffect(() => {
    if (searchQuery.trim()) return;

    if (activeChannel === 'indonesia') {
      setChannelTracks(indonesiaTrending);
      setIsChannelLoading(false);
      return;
    }
    if (activeChannel === 'global') {
      setChannelTracks(featuredTracks);
      setIsChannelLoading(false);
      return;
    }
    if (activeChannel === 'viral') {
      setChannelTracks(viralTracks);
      setIsChannelLoading(false);
      return;
    }
    if (activeChannel === 'indie-rnb') {
      setChannelTracks(indieRnbTracks);
      setIsChannelLoading(false);
      return;
    }

    const channel = CURATED_CHANNELS.find((c) => c.id === activeChannel);
    if (!channel?.query) return;

    const controller = new AbortController();
    setIsChannelLoading(true);
    searchOnlineTracks(channel.query, controller.signal, 30)
      .then(({ tracks }) => {
        if (controller.signal.aborted) return;
        registerTracks(tracks);
        setChannelTracks(tracks);
      })
      .catch(() => {
        if (!controller.signal.aborted) setChannelTracks([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsChannelLoading(false);
      });

    return () => controller.abort();
  }, [
    activeChannel,
    featuredTracks,
    indieRnbTracks,
    indonesiaTrending,
    registerTracks,
    searchQuery,
    viralTracks,
  ]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadLocalFiles(e.target.files);
      e.target.value = '';
    }
  };

  const activeChannelLabel =
    CURATED_CHANNELS.find((c) => c.id === activeChannel)?.label || 'Top Hits Indonesia';
  const showCuratedLoading = isChannelLoading || (isTrendingLoading && channelTracks.length === 0);

  return (
    <div className="space-y-8 pb-44 lg:pb-12">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Cari &amp; Jelajahi
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Temukan jutaan lagu Indonesia, Barat, K-Pop, J-Pop, hingga koleksi MP3 lokal secara penuh.
          </p>
        </div>

        {/* Unified Monochromatic Smoke Glass Search Pill (synced with Home) */}
        <div className="relative">
          <Search
            className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10"
            strokeWidth={1.9}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                recordRecentSearch(searchQuery);
              }
            }}
            placeholder="Cari lagu, artis, atau MV..."
            aria-label="Cari lagu, artis, atau lirik"
            className="w-full h-11 pl-11 pr-10 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] text-sm text-white placeholder-zinc-400 focus:outline-none focus:bg-white/[0.07] focus:border-white/25 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Bersihkan pencarian"
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/55 hover:text-white absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Dynamic Curated Category Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {CURATED_CHANNELS.map((channel) => {
            const selected = !searchQuery.trim() && activeChannel === channel.id;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) setSearchQuery('');
                  setActiveChannel(channel.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selected
                    ? 'bg-white text-[#0B0B0D]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-2xl text-zinc-300 hover:text-white border border-white/[0.08]'
                }`}
              >
                {channel.label}
              </button>
            );
          })}
        </div>

        {/* Recent Searches: Horizontal Clickable Chips (last 10 queries persisted in localStorage) */}
        {recentSearches.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60">
                <History className="w-3.5 h-3.5 text-white/50" strokeWidth={1.9} />
                <span>Pencarian Terakhir</span>
              </div>
              <button
                type="button"
                onClick={handleClearRecentSearches}
                className="text-[11px] font-medium text-white/45 hover:text-white/80 transition-colors"
              >
                Hapus Semua
              </button>
            </div>
            <div
              className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
              role="list"
              aria-label="Pencarian terakhir"
            >
              {recentSearches.map((term) => {
                const isActiveTerm = searchQuery.trim().toLowerCase() === term.toLowerCase();
                return (
                  <div
                    key={term}
                    role="listitem"
                    className={`inline-flex items-center rounded-full border transition-colors shrink-0 ${
                      isActiveTerm
                        ? 'bg-white text-[#0B0B0D] border-white'
                        : 'bg-white/[0.06] hover:bg-white/[0.11] text-white/85 border-white/[0.08]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectRecentSearch(term)}
                      className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-xs font-medium whitespace-nowrap"
                    >
                      <Clock
                        className={`w-3 h-3 shrink-0 ${
                          isActiveTerm ? 'text-[#0B0B0D]/70' : 'text-white/45'
                        }`}
                        strokeWidth={2}
                      />
                      <span className="max-w-[160px] truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecentSearch(term)}
                      aria-label={`Hapus ${term} dari pencarian terakhir`}
                      className={`p-1 mr-1 rounded-full transition-colors ${
                        isActiveTerm
                          ? 'text-[#0B0B0D]/60 hover:text-[#0B0B0D] hover:bg-black/10'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Koleksi Lokal */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-bold text-white">Koleksi Lokal</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono-tabular text-xs text-white/45">{localSearchMatches.length} lagu</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-white/10 hover:bg-white/15 border border-white/[0.08] transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Upload MP3</span>
            </button>
          </div>
        </div>

        {localSearchMatches.length === 0 ? (
          <p className="py-3 text-sm text-white/45">
            {searchQuery.trim()
              ? 'Tidak ada lagu lokal yang cocok dengan kata kunci tersebut.'
              : 'Belum ada file MP3 lokal tersimpan di browser.'}
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {localSearchMatches.map(({ track, snippet }, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextTracks={localSearchMatches.map((m) => m.track)}
                lyricSnippet={snippet}
              />
            ))}
          </div>
        )}
      </section>

      {/* Matched Cached Lyrics */}
      {lyricLibraryMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">Cocok Berdasarkan Lirik</h2>
            <span className="font-mono-tabular text-xs text-white/45">
              {lyricLibraryMatches.length} lagu
            </span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {lyricLibraryMatches.map(({ track, snippet }, idx) => (
              <TrackRow
                key={`lyric-${track.id}`}
                track={track}
                index={idx}
                contextTracks={lyricLibraryMatches.map((m) => m.track)}
                lyricSnippet={snippet}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Search Results OR Dynamic Curated Browse Feed */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-white">
            {searchQuery.trim() ? 'Hasil Pencarian Online' : activeChannelLabel}
          </h2>
          {searchQuery.trim() ? (
            isSearching ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/65">
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                <span>Mencari...</span>
              </span>
            ) : (
              onlineSearchResults.length > 0 && (
                <span className="font-mono-tabular text-xs text-white/45">
                  {onlineSearchResults.length} hasil
                </span>
              )
            )
          ) : (
            channelTracks.length > 0 && (
              <span className="font-mono-tabular text-xs text-white/45">
                {channelTracks.length} lagu
              </span>
            )
          )}
        </div>

        {!searchQuery.trim() ? (
          showCuratedLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {channelTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  contextTracks={channelTracks}
                />
              ))}
            </div>
          )
        ) : isSearching ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : onlineSearchResults.length === 0 ? (
          <p className="py-8 text-sm text-white/55">
            Tidak ada hasil ditemukan untuk &ldquo;{searchQuery}&rdquo;. Coba kata kunci artis atau judul lain.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {onlineSearchResults.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextTracks={onlineSearchResults}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
