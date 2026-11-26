import React, { useRef } from 'react';
import {
  AudioWaveform,
  Compass,
  Heart,
  Home,
  ListMusic,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    activeView,
    setActiveView,
    selectedPlaylistId,
    openPlaylist,
    playlists,
    likedIds,
    localTracks,
    setIsCreatePlaylistOpen,
    uploadLocalFiles,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNav = (view: 'home' | 'explore' | 'liked') => {
    setActiveView(view);
    onCloseMobile();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadLocalFiles(
        e.target.files,
        activeView === 'playlist' && selectedPlaylistId ? selectedPlaylistId : undefined
      );
      e.target.value = '';
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0E0E14] border-r border-white/[0.07] select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
        >
          <span className="w-8 h-8 rounded-xl bg-neon-gradient flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.35)]">
            <AudioWaveform className="w-4 h-4 text-[#0B0B0F]" strokeWidth={2.25} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap">
            Noct<span className="text-neon-gradient">y</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Tutup menu"
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#9499A6] hover:text-white hover:bg-white/[0.06]"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav aria-label="Navigasi utama" className="px-3 space-y-1">
        <button
          type="button"
          onClick={() => handleNav('home')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'home'
              ? 'bg-white/[0.08] text-white'
              : 'text-[#9499A6] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Home
            className={`w-4 h-4 shrink-0 ${activeView === 'home' ? 'text-lime-300' : ''}`}
            strokeWidth={1.75}
          />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNav('explore')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'explore'
              ? 'bg-white/[0.08] text-white'
              : 'text-[#9499A6] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Compass
            className={`w-4 h-4 shrink-0 ${activeView === 'explore' ? 'text-lime-300' : ''}`}
            strokeWidth={1.75}
          />
          <span>Explore</span>
        </button>

        <button
          type="button"
          onClick={() => handleNav('liked')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'liked'
              ? 'bg-white/[0.08] text-white'
              : 'text-[#9499A6] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Heart
              className={`w-4 h-4 shrink-0 ${
                activeView === 'liked' ? 'text-lime-300 fill-lime-300' : ''
              }`}
              strokeWidth={1.75}
            />
            <span>Liked Songs</span>
          </span>
          {likedIds.length > 0 && (
            <span className="font-mono-tabular text-xs text-[#9499A6]">{likedIds.length}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsCreatePlaylistOpen(true);
            onCloseMobile();
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#9499A6] hover:text-white hover:bg-white/[0.04] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0 text-emerald-400" strokeWidth={1.75} />
          <span>Create Playlist</span>
        </button>
      </nav>

      {/* Hybrid Local MP3 Upload CTA */}
      <div className="px-3 mt-4">
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
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#0B0B0F] bg-neon-gradient hover:brightness-110 active:scale-[0.99] transition-all shadow-[0_4px_20px_rgba(16,185,129,0.22)] whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          <span>+ Upload Lagu Lokal (MP3)</span>
        </button>
        {localTracks.length > 0 && (
          <p className="mt-2 px-1 text-[11px] text-[#9499A6] text-center font-mono-tabular">
            {localTracks.length} lagu lokal tersimpan
          </p>
        )}
      </div>

      {/* Custom Playlists Section */}
      <div className="mt-6 px-3 flex-1 min-h-0 flex flex-col">
        <div className="px-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#9499A6]">Playlist Anda</span>
          <span className="font-mono-tabular text-[11px] text-[#5B6070]">{playlists.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 pb-4">
          {playlists.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[#5B6070] leading-relaxed">
              Belum ada playlist. Buat satu untuk menggabungkan lagu streaming dan MP3 lokal.
            </p>
          ) : (
            playlists.map((pl) => {
              const isActive = activeView === 'playlist' && selectedPlaylistId === pl.id;
              return (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    openPlaylist(pl.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                    isActive
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'text-[#9499A6] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ListMusic
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-lime-300' : 'text-[#5B6070]'}`}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{pl.name}</span>
                  </span>
                  <span className="font-mono-tabular text-xs text-[#5B6070] shrink-0">
                    {pl.trackIds.length}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Minimalist Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-full">{sidebarContent}</aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
