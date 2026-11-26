import React, { useRef } from 'react';
import { AudioWaveform, Home, Search, Upload, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const TopBar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    searchQuery,
    setSearchQuery,
    uploadLocalFiles,
    selectedPlaylistId,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (activeView !== 'explore') {
      setActiveView('explore');
    }
  };

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
    <header className="h-16 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-3 bg-transparent select-none">
      {/* Left: Clean Apple-Style Wordmark */}
      <div className="flex items-center lg:w-[248px] shrink-0">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="flex items-center gap-2.5 text-left rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <span className="w-8 h-8 rounded-xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] flex items-center justify-center shadow-sm">
            <AudioWaveform className="w-4 h-4 text-white" strokeWidth={2.1} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            Nocty
          </span>
        </button>
      </div>

      {/* Center: Glass Home Trigger + Frosted Search Pill */}
      <div className="hidden sm:flex items-center justify-center gap-2.5 flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          aria-label="Home"
          title="Home"
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-all duration-150 ${
            activeView === 'home'
              ? 'bg-white/15 border-white/20 text-white'
              : 'bg-white/[0.05] border-white/[0.08] text-white/65 hover:text-white hover:bg-white/10'
          }`}
        >
          <Home className="w-[18px] h-[18px]" strokeWidth={1.85} />
        </button>

        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-white/45 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.85}
          />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => {
              if (activeView !== 'explore') setActiveView('explore');
            }}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cari lagu, artis Indonesia, atau lirik..."
            aria-label="Cari lagu, artis, atau lirik"
            className="w-full h-10 pl-10 pr-10 rounded-full bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.10] backdrop-blur-xl text-sm text-white placeholder-white/40 border border-white/[0.08] focus:border-white/25 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Bersihkan pencarian"
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 absolute right-1.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Right: Secondary Glass Upload MP3 CTA */}
      <div className="flex items-center justify-end lg:w-[248px] shrink-0">
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white bg-white/10 hover:bg-white/15 border border-white/[0.08] active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-white/80 shrink-0" strokeWidth={1.9} />
          <span>+ Upload MP3</span>
        </button>
      </div>
    </header>
  );
};
