import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Upload, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { searchOnlineTracks } from '../services/pipedApi';
import { Track } from '../types/music';
import { TrackRow } from './TrackRow';

const SUGGESTED_QUERIES = ['Tulus', 'Hindia', 'Bernadya', 'NIKI', 'Pamungkas', 'Coldplay'];

export const ExploreView: React.FC = () => {
  const { localTracks, trackRegistry, registerTracks, uploadLocalFiles } = usePlayer();

  const [query, setQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Instant search across Local IndexedDB tracks + cached lyrics snippets
  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = localTracks.map((t) => trackRegistry[t.id] || t);
    if (!q) return pool.map((track) => ({ track, snippet: undefined as string | undefined }));

    const matched: { track: Track; snippet?: string }[] = [];
    for (const track of pool) {
      const titleHit = track.title.toLowerCase().includes(q);
      const artistHit = track.artist.toLowerCase().includes(q);
      const lyricHit = track.lyrics.find((l) => l.text.toLowerCase().includes(q));
      const plainHit =
        !lyricHit && track.plainLyrics
          ? track.plainLyrics
              .split('\n')
              .find((line) => line.toLowerCase().includes(q))
          : undefined;

      if (titleHit || artistHit || lyricHit || plainHit) {
        matched.push({
          track,
          snippet: lyricHit?.text || plainHit,
        });
      }
    }
    return matched;
  }, [localTracks, query, trackRegistry]);

  // Also search cached/trending tracks by lyric snippet when user types a lyric phrase
  const lyricLibraryMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    const results: { track: Track; snippet: string }[] = [];
    for (const track of Object.values(trackRegistry)) {
      if (track.sourceType === 'local') continue;
      const line = track.lyrics.find((l) => l.text.toLowerCase().includes(q));
      if (line) {
        results.push({ track, snippet: line.text });
      }
    }
    return results;
  }, [query, trackRegistry]);

  // Debounced Piped API search (filter=music_songs)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setOnlineResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const { tracks } = await searchOnlineTracks(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        registerTracks(tracks);
        setOnlineResults(tracks);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setSearchError((err as Error).message || 'Pencarian online gagal.');
        setOnlineResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 360);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, registerTracks]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadLocalFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-7 pb-10">
      {/* Search Header */}
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Explore Musik
          </h1>
          <p className="mt-1 text-sm text-[#9499A6]">
            Cari jutaan lagu online secara real-time atau saring koleksi MP3 lokal berdasarkan judul, artis, dan lirik.
          </p>
        </div>

        <div className="relative max-w-2xl">
          <Search
            className="w-4 h-4 text-[#9499A6] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik judul lagu, artis (Tulus, Hindia, Bernadya), atau potongan lirik..."
            aria-label="Cari lagu, artis, atau lirik"
            className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-[#121218] border border-white/[0.1] text-sm text-white placeholder-[#5B6070] focus:outline-none focus:border-emerald-400/70 focus:shadow-[0_0_24px_rgba(16,185,129,0.14)] transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Bersihkan pencarian"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9499A6] hover:text-white hover:bg-white/[0.06] absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Quick Search Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5B6070]">Coba cari:</span>
          {SUGGESTED_QUERIES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                query.toLowerCase() === term.toLowerCase()
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-lime-300'
                  : 'border-white/[0.07] bg-[#121218] text-[#9499A6] hover:text-white hover:border-white/[0.16]'
              }`}
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Koleksi Lokal */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-white">
            Koleksi Lokal
          </h2>
          <div className="flex items-center gap-3">
            <span className="font-mono-tabular text-xs text-[#9499A6]">
              {localMatches.length} lagu
            </span>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-lime-300 bg-emerald-500/10 border border-emerald-400/25 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Upload MP3</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#121218]/65 border border-white/[0.07] p-2">
          {localMatches.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-sm text-[#9499A6]">
                {query.trim()
                  ? 'Tidak ada lagu lokal yang cocok dengan kata kunci tersebut.'
                  : 'Belum ada file MP3 lokal di penyimpanan browser. Unggah musik Anda untuk diputar kapan saja.'}
              </p>
            </div>
          ) : (
            localMatches.map(({ track, snippet }, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextTracks={localMatches.map((m) => m.track)}
                lyricSnippet={snippet}
              />
            ))
          )}
        </div>
      </section>

      {/* Matched Cached Lyrics from Online Tracks */}
      {lyricLibraryMatches.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Cocok Berdasarkan Lirik
            </h2>
            <span className="font-mono-tabular text-xs text-[#9499A6]">
              {lyricLibraryMatches.length} lagu
            </span>
          </div>
          <div className="rounded-2xl bg-[#121218]/65 border border-white/[0.07] p-2">
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

      {/* Section 2: Hasil Pencarian Online (Piped music_songs) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">
            Hasil Pencarian Online
          </h2>
          {isSearching ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
              <span>Mencari lagu...</span>
            </span>
          ) : (
            onlineResults.length > 0 && (
              <span className="font-mono-tabular text-xs text-[#9499A6]">
                {onlineResults.length} hasil
              </span>
            )
          )}
        </div>

        <div className="rounded-2xl bg-[#121218]/65 border border-white/[0.07] p-2">
          {!query.trim() ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm text-[#9499A6]">
                Ketik nama artis atau judul lagu di atas untuk mencari jutaan lagu full-duration secara real-time.
              </p>
            </div>
          ) : isSearching ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : searchError ? (
            <div className="py-10 px-4 text-center space-y-2">
              <p className="text-sm text-rose-300">{searchError}</p>
            </div>
          ) : onlineResults.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm text-[#9499A6]">
                Tidak ada hasil online ditemukan untuk &ldquo;{query}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {onlineResults.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  contextTracks={onlineResults}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
