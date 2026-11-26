import React, { useEffect, useRef, useState } from 'react';
import { ListPlus, MoreHorizontal, Play, Plus, Trash2 } from 'lucide-react';
import { Track } from '../types/music';
import { usePlayer } from '../context/PlayerContext';

interface TrackActionsMenuProps {
  track: Track;
  playlistIdContext?: string;
}

export const TrackActionsMenu: React.FC<TrackActionsMenuProps> = ({
  track,
  playlistIdContext,
}) => {
  const {
    playlists,
    addToQueue,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deleteLocalTrack,
    setIsCreatePlaylistOpen,
  } = usePlayer();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Opsi untuk ${track.title}`}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9499A6] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-10 z-50 w-56 rounded-xl bg-[#16161F]/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl p-1.5 text-sm text-[#F4F4F6]"
        >
          <button
            type="button"
            onClick={() => {
              addToQueue(track, true);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={1.75} />
            <span className="truncate">Putar Berikutnya</span>
          </button>

          <button
            type="button"
            onClick={() => {
              addToQueue(track, false);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors whitespace-nowrap"
          >
            <ListPlus className="w-4 h-4 text-[#9499A6] shrink-0" strokeWidth={1.75} />
            <span className="truncate">Tambahkan ke Antrean</span>
          </button>

          <div className="my-1 border-t border-white/[0.07]" />

          <div className="px-3 py-1 text-xs text-[#9499A6]">Simpan ke Playlist</div>

          {playlists.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setIsCreatePlaylistOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-emerald-400 hover:bg-emerald-500/10 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span>Buat Playlist Baru</span>
            </button>
          ) : (
            <div className="max-h-36 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    addTrackToPlaylist(pl.id, track);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left hover:bg-white/[0.06] transition-colors"
                >
                  <span className="truncate">{pl.name}</span>
                  <Plus className="w-3.5 h-3.5 text-[#9499A6] shrink-0" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          )}

          {playlistIdContext && (
            <>
              <div className="my-1 border-t border-white/[0.07]" />
              <button
                type="button"
                onClick={() => {
                  removeTrackFromPlaylist(playlistIdContext, track.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-rose-400 hover:bg-rose-500/10 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>Hapus dari Playlist</span>
              </button>
            </>
          )}

          {track.sourceType === 'local' && !playlistIdContext && (
            <>
              <div className="my-1 border-t border-white/[0.07]" />
              <button
                type="button"
                onClick={() => {
                  deleteLocalTrack(track.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-rose-400 hover:bg-rose-500/10 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>Hapus File Lokal</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
