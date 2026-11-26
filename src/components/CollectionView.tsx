import React, { useRef } from 'react';
import { Disc3, Heart, ListMusic, Play, Shuffle, Trash2, Upload } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { Track } from '../types/music';
import { formatDuration, smartShuffleTracks } from '../utils/audioUtils';
import { TrackRow } from './TrackRow';

interface CollectionViewProps {
  mode: 'liked' | 'playlist' | 'local';
}

export const CollectionView: React.FC<CollectionViewProps> = ({ mode }) => {
  const {
    likedTracks,
    localTracks,
    playlists,
    selectedPlaylistId,
    trackRegistry,
    playTrack,
    deletePlaylist,
    uploadLocalFiles,
    setActiveView,
    listeningHistory,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const playlist =
    mode === 'playlist' ? playlists.find((p) => p.id === selectedPlaylistId) || null : null;

  const tracks: Track[] =
    mode === 'liked'
      ? likedTracks
      : mode === 'local'
        ? localTracks
        : playlist
          ? playlist.trackIds
              .map((id) => trackRegistry[id])
              .filter((t): t is Track => Boolean(t))
          : [];

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  if (mode === 'playlist' && !playlist) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-white/55">Playlist tidak ditemukan.</p>
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="px-5 py-2 rounded-full text-xs font-semibold text-[#0B0B0D] bg-white hover:bg-white/90"
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

  const title =
    mode === 'liked' ? 'Liked Songs' : mode === 'local' ? 'Lagu Lokal MP3' : playlist?.name;
  const kicker =
    mode === 'liked'
      ? 'Koleksi Favorit'
      : mode === 'local'
        ? 'Penyimpanan Browser Permanen'
        : 'Playlist Pribadi';

  return (
    <div className="space-y-7 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/[0.08] backdrop-blur-2xl border border-white/[0.10] flex items-center justify-center shrink-0 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
            {mode === 'liked' ? (
              <Heart className="w-9 h-9 text-white fill-white" strokeWidth={1.75} />
            ) : mode === 'local' ? (
              <Disc3 className="w-9 h-9 text-white/90" strokeWidth={1.75} />
            ) : (
              <ListMusic className="w-9 h-9 text-white/90" strokeWidth={1.75} />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-white/55">{kicker}</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white truncate">
              {title}
            </h1>
            {playlist?.description && (
              <p className="mt-1 text-sm text-white/60 line-clamp-1">{playlist.description}</p>
            )}
            <p className="mt-2 text-xs text-white/50 font-mono-tabular">
              {tracks.length} lagu · {formatDuration(totalDuration)} total durasi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={tracks.length === 0}
            onClick={() =>
              tracks[0] && playTrack(tracks[0], tracks, { preserveOrder: true })
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-[#0B0B0D] bg-white hover:bg-white/90 disabled:opacity-40 transition-all shadow-lg whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-[#0B0B0D]" strokeWidth={2} />
            <span>Putar Semua</span>
          </button>

          <button
            type="button"
            disabled={tracks.length === 0}
            onClick={() => {
              const shuffled = smartShuffleTracks(tracks, listeningHistory);
              if (shuffled[0]) playTrack(shuffled[0], shuffled, { preserveOrder: true });
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/[0.08] text-white disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4 text-white/80" strokeWidth={1.85} />
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/[0.08] text-white transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-white/80" strokeWidth={1.85} />
            <span>Tambah MP3</span>
          </button>

          {playlist && (
            <button
              type="button"
              onClick={() => deletePlaylist(playlist.id)}
              aria-label="Hapus playlist"
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-rose-500/20 border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.85} />
            </button>
          )}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm text-white/55">
            {mode === 'liked'
              ? 'Belum ada lagu yang disukai. Ketuk ikon hati pada lagu mana pun untuk menyimpannya di sini.'
              : mode === 'local'
                ? 'Belum ada file MP3 lokal yang diunggah.'
                : 'Playlist ini masih kosong. Tambahkan lagu dari Explore atau unggah MP3 lokal langsung.'}
          </p>
          <button
            type="button"
            onClick={() => (mode === 'local' ? fileInputRef.current?.click() : setActiveView('explore'))}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#0B0B0D] bg-white hover:bg-white/90 transition-colors"
          >
            {mode === 'local' ? '+ Upload MP3' : 'Cari Lagu'}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              contextTracks={tracks}
              playlistIdContext={playlist?.id}
              preserveQueueOrder={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};
