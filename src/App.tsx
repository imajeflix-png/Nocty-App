import React, { useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ExploreView } from './components/ExploreView';
import { CollectionView } from './components/CollectionView';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { FloatingPlayerDock } from './components/FloatingPlayerDock';
import { ZenFocusMode } from './components/ZenFocusMode';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { MobileNavBar } from './components/MobileNavBar';
import { ErrorBoundary } from './components/ErrorBoundary';

const NoctyShell: React.FC = () => {
  const { activeView, setActiveView, ambientColor, toasts } = usePlayer();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0B0B0F] text-[#F4F4F6] flex">
      {/* Left Minimalist Sidebar */}
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      {/* Center Scrollable Main Stage with Dynamic Ambient Backdrop */}
      <main className="relative flex-1 min-w-0 h-full overflow-y-auto">
        {/* Adaptive Cover Radial Ambient Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed lg:absolute inset-x-0 top-0 h-[420px] transition-all duration-1000"
          style={{
            background: `radial-gradient(ellipse 80% 70% at 35% 0%, rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, 0.20) 0%, rgba(16, 185, 129, 0.06) 45%, transparent 75%)`,
          }}
        />

        {/* Compact Mobile Top Bar */}
        <header className="sticky top-0 z-20 lg:hidden flex items-center justify-between px-4 py-3 bg-[#0B0B0F]/80 backdrop-blur-lg border-b border-white/[0.06]">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Buka menu navigasi"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#F4F4F6] hover:bg-white/[0.06]"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>

          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Noct<span className="text-neon-gradient">y</span>
          </span>

          <button
            type="button"
            onClick={() => setActiveView('explore')}
            aria-label="Buka pencarian"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#9499A6] hover:text-white hover:bg-white/[0.06]"
          >
            <Search className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </header>

        {/* Active View Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-7 pt-6 sm:pt-8 pb-36 lg:pb-32">
          {activeView === 'home' && <HomeView />}
          {activeView === 'explore' && <ExploreView />}
          {activeView === 'liked' && <CollectionView mode="liked" />}
          {activeView === 'playlist' && <CollectionView mode="playlist" />}
        </div>
      </main>

      {/* Right Toggleable Queue & Synced Lyrics Inspector */}
      <RightInspectorPanel />

      {/* Glassmorphism Floating Bottom Audio Player Dock */}
      <FloatingPlayerDock />

      {/* Mobile Bottom Navigation */}
      <MobileNavBar />

      {/* Immersive Zen / Focus Mode Overlay */}
      <ZenFocusMode />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal />

      {/* Non-blocking Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium backdrop-blur-xl border shadow-xl transition-all ${
                toast.tone === 'error'
                  ? 'bg-rose-950/90 border-rose-500/35 text-rose-200'
                  : toast.tone === 'success'
                    ? 'bg-[#121816]/90 border-emerald-400/35 text-lime-200'
                    : 'bg-[#16161F]/90 border-white/[0.1] text-[#F4F4F6]'
              }`}
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PlayerProvider>
        <NoctyShell />
      </PlayerProvider>
    </ErrorBoundary>
  );
}
