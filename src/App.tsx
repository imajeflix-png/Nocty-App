import React from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ExploreView } from './components/ExploreView';
import { CollectionView } from './components/CollectionView';
import { LibraryView } from './components/LibraryView';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { FloatingPlayerDock } from './components/FloatingPlayerDock';
import { ZenFocusMode } from './components/ZenFocusMode';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { MobileNavBar } from './components/MobileNavBar';
import { ErrorBoundary } from './components/ErrorBoundary';

const NoctyShell: React.FC = () => {
  const { activeView, ambientPalette, toasts } = usePlayer();
  const { primary, secondary } = ambientPalette;

  return (
    <div className="relative z-10 h-screen w-screen overflow-hidden bg-transparent text-[#F5F5F7] flex flex-col">
      {/* Global Dual-Color Dynamic Ambient Gradient Backdrop */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-36 -left-24 w-[62vw] h-[62vw] max-w-[780px] max-h-[780px] rounded-full blur-3xl opacity-25 transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.95) 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute -bottom-40 -right-24 w-[58vw] h-[58vw] max-w-[720px] max-h-[720px] rounded-full blur-3xl opacity-20 transition-all duration-1000"
          style={{
            background: `radial-gradient(circle, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.95) 0%, transparent 70%)`,
          }}
        />
      </div>

      {/* Minimal Top Bar */}
      <div className="relative z-10 shrink-0">
        <TopBar />
      </div>

      {/* Airy Glass Workspace */}
      <div className="relative z-10 flex-1 min-h-0 flex gap-3 px-3 pb-0 lg:pb-3">
        {/* Compact Frosted Glass Left Sidebar */}
        <Sidebar />

        {/* Spacious Frosted Glass Main View */}
        <main className="relative flex-1 min-w-0 h-full rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] overflow-y-auto scroll-pt-8">
          {/* Soft Cover-Adaptive Ambient Aura inside Main View */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 inset-x-0 h-[380px] blur-3xl opacity-25 transition-all duration-1000"
            style={{
              background: `
                radial-gradient(ellipse 65% 60% at 22% 15%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9) 0%, transparent 72%),
                radial-gradient(ellipse 55% 55% at 78% 10%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.85) 0%, transparent 70%)
              `,
            }}
          />

          <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-7 pt-8 sm:pt-10 pb-36 lg:pb-12">
            {activeView === 'home' && <HomeView />}
            {activeView === 'explore' && <ExploreView />}
            {activeView === 'liked' && <CollectionView mode="liked" />}
            {activeView === 'local' && <CollectionView mode="local" />}
            {activeView === 'playlist' && <CollectionView mode="playlist" />}
            {activeView === 'library' && <LibraryView />}
          </div>
        </main>

        {/* Right Panel: Queue & Synced Lyrics (Default CLOSED) */}
        <RightInspectorPanel />
      </div>

      {/* Floating Frosted Glass Player Bar + Mobile Mini-Player */}
      <div className="relative z-20 shrink-0">
        <FloatingPlayerDock />
      </div>

      {/* Mobile 3-Tab Bottom Navigation */}
      <MobileNavBar />

      {/* Fullscreen Zen / Now Playing Overlay */}
      <ZenFocusMode />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal />

      {/* Non-Blocking Frosted Glass Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-[68px] right-4 z-[60] space-y-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[#18181D]/85 backdrop-blur-2xl border border-white/[0.10] text-white shadow-2xl transition-all"
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
