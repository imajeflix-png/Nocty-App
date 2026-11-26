import React, { useRef } from 'react';
import { Compass, Disc3, Heart, Home, ListMusic, Plus, Upload } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    selectedPlaylistId,
    openPlaylist,
    playlists,
    likedIds,
    localTracks,
    trackRegistry,
    setIsCreatePlaylistOpen,
    uploadLocalFiles,
    isInstallable,
    promptInstallApp,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadLocalFiles(
        e.target.files,
        activeView === 'playlist' && selectedPlaylistId ? selectedPlaylistId : undefined
      );
      e.target.value = '';
    }
  };

  return (
    <aside
      aria-label="Navigasi Utama"
      className="hidden lg:flex w-[248px] shrink-0 rounded-2xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] flex-col overflow-hidden select-none"
    >
      {/* Primary Navigation */}
      <nav className="p-3 space-y-1">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'home'
              ? 'bg-white/12 text-white'
              : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" strokeWidth={activeView === 'home' ? 2.1 : 1.75} />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('explore')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'explore'
              ? 'bg-white/12 text-white'
              : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Compass className="w-4 h-4 shrink-0" strokeWidth={activeView === 'explore' ? 2.1 : 1.75} />
          <span>Explore</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('liked')}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'liked'
              ? 'bg-white/12 text-white'
              : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3 min-w-0">
            <Heart
              className={`w-4 h-4 shrink-0 ${activeView === 'liked' ? 'fill-white' : ''}`}
              strokeWidth={1.85}
            />
            <span className="truncate">Liked</span>
          </span>
          <span className="font-mono-tabular text-xs text-white/45 shrink-0">{likedIds.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('local')}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
            activeView === 'local'
              ? 'bg-white/12 text-white'
              : 'text-white/65 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3 min-w-0">
            <Disc3 className="w-4 h-4 shrink-0" strokeWidth={1.85} />
            <span className="truncate">Lokal MP3</span>
          </span>
          <span className="font-mono-tabular text-xs text-white/45 shrink-0">{localTracks.length}</span>
        </button>
      </nav>

      <div className="mx-3 border-t border-white/[0.07]" />

      {/* Playlist Section Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveView('library')}
          className="text-xs font-semibold tracking-wide text-white/55 hover:text-white transition-colors"
        >
          Playlist
        </button>

        <button
          type="button"
          onClick={() => setIsCreatePlaylistOpen(true)}
          aria-label="Buat Playlist Baru"
          title="Buat Playlist Baru"
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Scrollable Playlists */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-0.5">
        {playlists.length === 0 ? (
          <div className="mt-2 mx-1 p-3.5 rounded-xl bg-white/[0.04] space-y-2.5">
            <p className="text-xs font-medium text-white/90">Belum ada playlist</p>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Simpan lagu favorit dan MP3 lokal ke satu daftar putar.
            </p>
            <button
              type="button"
              onClick={() => setIsCreatePlaylistOpen(true)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#0B0B0D] bg-white hover:bg-white/90 transition-colors"
            >
              Buat Playlist
            </button>
          </div>
        ) : (
          playlists.map((pl) => {
            const isActive = activeView === 'playlist' && selectedPlaylistId === pl.id;
            const firstTrack = pl.trackIds[0] ? trackRegistry[pl.trackIds[0]] : undefined;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => openPlaylist(pl.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
                  isActive ? 'bg-white/12' : 'hover:bg-white/[0.06]'
                }`}
              >
                {firstTrack ? (
                  <CoverArt
                    src={firstTrack.coverUrl}
                    alt={pl.name}
                    className="w-10 h-10"
                    roundedClass="rounded-lg"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0">
                    <ListMusic
                      className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/55'}`}
                      strokeWidth={1.75}
                    />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-white/85'}`}>
                    {pl.name}
                  </p>
                  <p className="text-xs text-white/45 truncate font-mono-tabular">
                    {pl.trackIds.length} lagu
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Bottom Upload MP3 Trigger */}
      <div className="p-3 border-t border-white/[0.07] space-y-2">
        {isInstallable && (
          <button
            type="button"
            onClick={promptInstallApp}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-[#0B0B0D] bg-white hover:bg-white/90 transition-colors whitespace-nowrap shadow-md"
          >
            <AppleEmoji unified="2728" size={14} />
            <span>Install App (PWA)</span>
          </button>
        )}
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
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium text-white bg-white/10 hover:bg-white/15 border border-white/[0.08] transition-colors whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" strokeWidth={1.85} />
          <span>+ Upload MP3</span>
        </button>
      </div>
    </aside>
  );
};
