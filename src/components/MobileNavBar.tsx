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
        className="pointer-events-auto relative overflow-hidden mx-5 mb-4 rounded-full bg-white/[0.08] backdrop-blur-3xl backdrop-saturate-[1.8] saturate-150 border border-white/[0.22] shadow-[inset_0_1px_1px_rgba(255,255,255,0.38),0_16px_40px_rgba(0,0,0,0.45)] px-2 py-2 grid grid-cols-4 gap-1"
      >
        {/* Top curved specular edge sheen */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent"
        />

        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-current={tab.active ? 'page' : undefined}
              className={`relative z-10 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition-all duration-200 min-w-0 ${
                tab.active
                  ? 'text-white bg-gradient-to-b from-white/25 to-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]'
                  : 'text-white/65 hover:text-white/95'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={tab.active ? 2.2 : 1.75} />
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

