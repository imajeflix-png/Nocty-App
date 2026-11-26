import React from 'react';
import { Compass, Home, Library } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const MobileNavBar: React.FC = () => {
  const { activeView, setActiveView } = usePlayer();

  const isLibraryActive =
    activeView === 'library' ||
    activeView === 'liked' ||
    activeView === 'playlist' ||
    activeView === 'local';

  return (
    <nav
      aria-label="Navigasi seluler"
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-[#0B0B0D]/80 backdrop-blur-2xl border-t border-white/[0.08] grid grid-cols-3 h-[54px]"
    >
      <button
        type="button"
        onClick={() => setActiveView('home')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
          activeView === 'home' ? 'text-white' : 'text-white/50 hover:text-white/80'
        }`}
      >
        <Home className="w-[18px] h-[18px]" strokeWidth={activeView === 'home' ? 2.2 : 1.75} />
        <span>Home</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveView('explore')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
          activeView === 'explore' ? 'text-white' : 'text-white/50 hover:text-white/80'
        }`}
      >
        <Compass className="w-[18px] h-[18px]" strokeWidth={activeView === 'explore' ? 2.2 : 1.75} />
        <span>Explore</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveView('library')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
          isLibraryActive ? 'text-white' : 'text-white/50 hover:text-white/80'
        }`}
      >
        <Library className="w-[18px] h-[18px]" strokeWidth={isLibraryActive ? 2.2 : 1.75} />
        <span>Library</span>
      </button>
    </nav>
  );
};
