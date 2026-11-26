import React, { useRef } from 'react';
import { Heart, ListMusic, Play, Shuffle, Trash2, Upload } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { Track } from '../types/music';
import { formatDuration } from '../utils/audioUtils';
import { fisherYatesShuffle } from '../utils/audioUtils';
import { TrackRow } from './TrackRow';

interface CollectionViewProps {
  mode: 'liked' | 'playlist';
}

export const CollectionView: React.FC<CollectionViewProps> = ({ mode }) => {
  const {
    likedTracks,
    playlists,
    selectedPlaylistId,
    trackRegistry,
    playTrack,
    deletePlaylist,
    uploadLocalFiles,
    setActiveView,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const playlist =
    mode === 'playlist'
      ? playlists.find((p) => p.id === selectedPlaylistId) || null
      : null;

  const tracks: Track[] =
    mode === 'liked'
      ? likedTracks
      : playlist
        ? playlist.trackIds
            .map((id) => trackRegistry[id])
            .filter((t): t is Track => Boolean(t))
        : [];

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  if (mode === 'playlist' && !playlist) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-[#9499A6]">Playlist tidak ditemukan.</p>
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0F] bg-neon-gradient"
        >
          Kembali ke Home
        </button>
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadLocalFiles(e.target.files, playlist?.id);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Collection Header */}
      <div className="rounded-2xl bg-[#121218]/85 border border-white/[0.08] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-500/25 via-[#181822] to-lime-400/25 border border-emerald-400/25 flex items-center justify-center shrink-0">
            {mode === 'liked' ? (
              <Heart className="w-9 h-9 text-lime-300 fill-lime-300" strokeWidth={1.75} />
            ) : (
              <ListMusic className="w-9 h-9 text-emerald-400" strokeWidth={1.75} />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-400">
              {mode === 'liked' ? 'Koleksi Favorit' : 'Playlist Pribadi'}
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white truncate">
              {mode === 'liked' ? 'Liked Songs' : playlist?.name}
            </h1>
            {playlist?.description && (
              <p className="mt-1 text-sm text-[#9499A6] line-clamp-1">{playlist.description}</p>
            )}
            <p className="mt-2 text-xs text-[#9499A6] font-mono-tabular">
              {tracks.length} lagu · {formatDuration(totalDuration)} total durasi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={tracks.length === 0}
            onClick={() => tracks[0] && playTrack(tracks[0], tracks)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0B0B0F] bg-neon-gradient hover:brightness-110 disabled:opacity-40 transition-all whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-[#0B0B0F]" strokeWidth={2} />
            <span>Putar Semua</span>
          </button>

          <button
            type="button"
            disabled={tracks.length === 0}
            onClick={() => {
              const shuffled = fisherYatesShuffle(tracks);
              if (shuffled[0]) playTrack(shuffled[0], shuffled);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/[0.08] bg-white/[0.03] text-[#F4F4F6] hover:bg-white/[0.07] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
            <span>Acak</span>
          </button>

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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-emerald-400/25 bg-emerald-500/10 text-lime-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4" strokeWidth={1.75} />
            <span>Tambah MP3</span>
          </button>

          {playlist && (
            <button
              type="button"
              onClick={() => deletePlaylist(playlist.id)}
              aria-label="Hapus playlist"
              className="w-10 h-10 rounded-xl border border-white/[0.08] flex items-center justify-center text-[#9499A6] hover:text-rose-400 hover:border-rose-400/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Track List */}
      <div className="rounded-2xl bg-[#121218]/65 border border-white/[0.07] p-2 sm:p-3">
        {tracks.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-3">
            <p className="text-sm text-[#9499A6]">
              {mode === 'liked'
                ? 'Belum ada lagu yang disukai. Ketuk ikon hati pada lagu mana pun untuk menyimpannya di sini.'
                : 'Playlist ini masih kosong. Tambahkan lagu dari Explore atau unggah MP3 lokal langsung.'}
            </p>
            <button
              type="button"
              onClick={() => setActiveView('explore')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0B0F] bg-neon-gradient"
            >
              Jelajahi Lagu
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                contextTracks={tracks}
                playlistIdContext={playlist?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
