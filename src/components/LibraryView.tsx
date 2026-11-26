import React, { useRef } from 'react';
import { ChevronRight, Heart, ListMusic, Plus, Upload } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { TrackRow } from './TrackRow';

export const LibraryView: React.FC = () => {
  const {
    likedTracks,
    playlists,
    localTracks,
    setActiveView,
    openPlaylist,
    setIsCreatePlaylistOpen,
    uploadLocalFiles,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadLocalFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Library Anda
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Lagu favorit, playlist pribadi, dan koleksi MP3 lokal tersimpan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white bg-white/10 hover:bg-white/15 border border-white/[0.08] transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Upload MP3</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatePlaylistOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#0B0B0D] bg-white hover:bg-white/90 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.1} />
            <span>Buat Playlist</span>
          </button>
        </div>
      </div>

      {/* Quick Library Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setActiveView('liked')}
          className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] transition-all text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 text-white fill-white" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-white">Liked Songs</p>
              <p className="text-xs text-white/55 font-mono-tabular mt-0.5">
                {likedTracks.length} lagu favorit
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/45 shrink-0" />
        </button>

        {playlists.map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => openPlaylist(pl.id)}
            className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all text-left"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <ListMusic className="w-5 h-5 text-white/80" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold text-white truncate">{pl.name}</p>
                <p className="text-xs text-white/55 font-mono-tabular mt-0.5">
                  {pl.trackIds.length} lagu
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/45 shrink-0" />
          </button>
        ))}
      </div>

      {/* Local MP3s stored in nocty-audio-db */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">Lagu Lokal Tersimpan</h2>
          <span className="font-mono-tabular text-xs text-white/45">{localTracks.length} file</span>
        </div>

        {localTracks.length === 0 ? (
          <p className="py-6 text-sm text-white/45">
            Belum ada file MP3 lokal di browser. Tekan &ldquo;Upload MP3&rdquo; untuk menyimpannya secara permanen.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {localTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextTracks={localTracks}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
