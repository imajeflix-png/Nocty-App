import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const CreatePlaylistModal: React.FC = () => {
  const { isCreatePlaylistOpen, setIsCreatePlaylistOpen, createPlaylist, openPlaylist } = usePlayer();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isCreatePlaylistOpen) {
      setName('');
      setDescription('');
    }
  }, [isCreatePlaylistOpen]);

  if (!isCreatePlaylistOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pl = createPlaylist(name, description);
    setIsCreatePlaylistOpen(false);
    openPlaylist(pl.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={() => setIsCreatePlaylistOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-playlist-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-[#16161B]/90 backdrop-blur-md border border-white/[0.10] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="create-playlist-title" className="font-display text-lg font-semibold text-white">
            Buat Playlist Baru
          </h2>
          <button
            type="button"
            onClick={() => setIsCreatePlaylistOpen(false)}
            aria-label="Tutup"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="playlist-name" className="block text-xs font-medium text-white/60 mb-1.5">
              Nama Playlist
            </label>
            <input
              id="playlist-name"
              type="text"
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: Fokus Larut Malam"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="playlist-desc" className="block text-xs font-medium text-white/60 mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <input
              id="playlist-desc"
              type="text"
              maxLength={120}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campuran lagu lokal & streaming favorit"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatePlaylistOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-white/10 hover:bg-white/15 text-white transition-colors whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 rounded-full text-sm font-semibold text-[#0B0B0D] bg-white hover:bg-white/90 disabled:opacity-40 transition-all whitespace-nowrap"
            >
              Simpan Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
