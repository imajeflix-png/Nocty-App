import React from 'react';
import { Compass, Heart, Home, ListOrdered, Mic2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const MobileNavBar: React.FC = () => {
  const { activeView, setActiveView, rightPanelTab, toggleRightPanelTab } = usePlayer();

  return (
    <nav
      aria-label="Navigasi seluler"
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-[#0E0E14]/95 backdrop-blur-xl border-t border-white/[0.08] grid grid-cols-5 h-14"
    >
      <button
        type="button"
        onClick={() => setActiveView('home')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeView === 'home' ? 'text-lime-300' : 'text-[#9499A6]'
        }`}
      >
        <Home className="w-4 h-4" strokeWidth={1.75} />
        <span>Home</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveView('explore')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeView === 'explore' ? 'text-lime-300' : 'text-[#9499A6]'
        }`}
      >
        <Compass className="w-4 h-4" strokeWidth={1.75} />
        <span>Explore</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveView('liked')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          activeView === 'liked' ? 'text-lime-300' : 'text-[#9499A6]'
        }`}
      >
        <Heart className="w-4 h-4" strokeWidth={1.75} />
        <span>Liked</span>
      </button>

      <button
        type="button"
        onClick={() => toggleRightPanelTab('queue')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          rightPanelTab === 'queue' ? 'text-lime-300' : 'text-[#9499A6]'
        }`}
      >
        <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
        <span>Antrean</span>
      </button>

      <button
        type="button"
        onClick={() => toggleRightPanelTab('lyrics')}
        className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
          rightPanelTab === 'lyrics' ? 'text-lime-300' : 'text-[#9499A6]'
        }`}
      >
        <Mic2 className="w-4 h-4" strokeWidth={1.75} />
        <span>Lirik</span>
      </button>
    </nav>
  );
};
