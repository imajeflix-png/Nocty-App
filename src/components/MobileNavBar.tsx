import React from 'react';
import { Compass, Home, Library, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { triggerHaptic } from '../utils/haptics';

export const MobileNavBar: React.FC = () => {
  const { activeView, setActiveView } = usePlayer();

  const isLibraryActive =
    activeView === 'library' ||
    activeView === 'liked' ||
    activeView === 'playlist' ||
    activeView === 'local';

  const tabs = [
    {
      id: 'home' as const,
      label: 'Home',
      active: activeView === 'home',
      icon: Home,
      onClick: () => {
        triggerHaptic(12);
        setActiveView('home');
      },
    },
    {
      id: 'explore' as const,
      label: 'Explore',
      active: activeView === 'explore',
      icon: Compass,
      onClick: () => {
        triggerHaptic(12);
        setActiveView('explore');
      },
    },
    {
      id: 'studio' as const,
      label: 'Studio',
      active: activeView === 'studio',
      icon: Sparkles,
      onClick: () => {
        triggerHaptic(12);
        setActiveView('studio');
      },
    },
    {
      id: 'library' as const,
      label: 'Library',
      active: isLibraryActive,
      icon: Library,
      onClick: () => {
        triggerHaptic(12);
        setActiveView('library');
      },
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden pointer-events-none">
      <nav
        aria-label="Navigasi seluler"
        className="pointer-events-auto mx-5 mb-4 rounded-full bg-white/[0.05] backdrop-blur-2xl border border-white/[0.10] shadow-[0_12px_32px_rgba(0,0,0,0.55)] px-2 py-2 grid grid-cols-4 gap-1"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-current={tab.active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition-colors duration-200 min-w-0 ${
                tab.active
                  ? 'text-white bg-white/[0.14]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={tab.active ? 2.15 : 1.75} />
              <span className="text-[11px] font-medium leading-tight tracking-tight truncate max-w-full px-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

