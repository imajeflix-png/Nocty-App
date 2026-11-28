import React, { useRef } from 'react';
import { NetworkModeProvider } from './context/NetworkModeContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { SettingsProvider } from './context/SettingsContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { ExploreView } from './components/ExploreView';
import { CollectionView } from './components/CollectionView';
import { LibraryView } from './components/LibraryView';
import { StudioView } from './components/StudioView';
import { SettingsView } from './components/SettingsView';
import { RightInspectorPanel } from './components/RightInspectorPanel';
import { FloatingPlayerDock } from './components/FloatingPlayerDock';
import { ZenFocusMode } from './components/ZenFocusMode';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { MobileNavBar } from './components/MobileNavBar';
import { LyricWhisperModal } from './components/LyricWhisperModal';
import { LyricCardModal } from './components/LyricCardModal';
import { WhisperReceiverModal } from './components/WhisperReceiverModal';
import { WeeklyAuraModal } from './components/WeeklyAuraModal';
import { NoctyTwinModal } from './components/NoctyTwinModal';
import { SlipNoctyModal } from './components/SlipNoctyModal';
import { NoctyStudioSheet } from './components/NoctyStudioSheet';
import { DynamicIslandPill } from './components/DynamicIslandPill';
import { NetworkModePrompt } from './components/NetworkModePrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useTabSwipeNavigation } from './hooks/useTabSwipeNavigation';

const NoctyShell: React.FC = () => {
  const { activeView, setActiveView, isZenMode, currentTrack, ambientPalette, toasts } = usePlayer();
  const { primary, secondary, gradientIntensity } = ambientPalette;
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const { touchHandlers, contentStyle } = useTabSwipeNavigation({
    activeView,
    setActiveView,
    disabled: isZenMode,
    scrollContainerRef: mainScrollRef,
  });

  return (
    <div className="relative z-10 h-screen w-screen overflow-hidden bg-transparent text-[#111318] dark:text-[#F5F5F7] flex flex-col">
      {/* Minimal Top Bar */}
      <div className="relative z-10 shrink-0">
        <TopBar />
      </div>

      {/* Neutral Monochromatic Smoke Glass Workspace */}
      <div className="relative z-10 flex-1 min-h-0 flex gap-3 px-3 pb-0 lg:pb-3">
        {/* Compact Smoke Glass Left Sidebar */}
        <Sidebar />

        {/* Spacious Monochromatic Smoke Glass Main View */}
        <main
          ref={mainScrollRef}
          {...touchHandlers}
          className="relative flex-1 min-w-0 h-full rounded-[24px] bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] overflow-y-auto overflow-x-hidden touch-pan-y scroll-pt-8"
        >
          {/* Quiet Artwork-Only Ambient Depth (zero hardcoded purple/neon fallbacks) */}
          {currentTrack && (
            <div
              aria-hidden="true"
              className="ambient-aura-layer pointer-events-none absolute -top-28 inset-x-0 h-[340px] blur-[110px] transition-all duration-1000"
              style={{
                opacity: Math.min(0.24, gradientIntensity * 0.45),
                background: `
                  radial-gradient(ellipse 60% 55% at 24% 12%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85) 0%, transparent 72%),
                  radial-gradient(ellipse 50% 50% at 78% 10%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.75) 0%, transparent 70%)
                `,
              }}
            />
          )}

          <div
            style={contentStyle}
            className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-7 pt-5 sm:pt-7 pb-0"
          >
            {activeView === 'home' && <HomeView />}
            {activeView === 'explore' && <ExploreView />}
            {activeView === 'studio' && <StudioView />}
            {activeView === 'liked' && <CollectionView mode="liked" />}
            {activeView === 'local' && <CollectionView mode="local" />}
            {activeView === 'playlist' && <CollectionView mode="playlist" />}
            {activeView === 'library' && <LibraryView />}
            {activeView === 'settings' && <SettingsView />}
          </div>
        </main>

        {/* Right Panel: Queue & Synced Lyrics (Default CLOSED) */}
        <RightInspectorPanel />
      </div>

      {/* Floating Frosted Glass Player Bar + Mobile Mini-Player */}
      <div className="relative z-20 shrink-0">
        <FloatingPlayerDock />
      </div>

      {/* Mobile 4-Tab Apple Liquid Glass Bottom Navigation */}
      <MobileNavBar />

      {/* Interactive iOS Dynamic Island Pill (visible across Web & APK whenever a track is loaded outside ZenFocusMode) */}
      <DynamicIslandPill />

      {/* Adaptive Smart Network Consent / Recovery Prompt */}
      <NetworkModePrompt />

      {/* Fullscreen Zen / Now Playing Overlay */}
      <ZenFocusMode />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal />

      {/* Lyric Whisper Composer, 9:16 Shareable Card, ?whisper= Receiver & Weekly Aura */}
      <LyricWhisperModal />
      <LyricCardModal />
      <WhisperReceiverModal />
      <WeeklyAuraModal />
      <NoctyTwinModal />
      <SlipNoctyModal />
      <NoctyStudioSheet />

      {/* Non-Blocking Frosted Glass Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-[68px] right-4 z-[60] space-y-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[#121215]/85 backdrop-blur-2xl border border-white/[0.08] text-white shadow-2xl transition-all"
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
      <SettingsProvider>
        <NetworkModeProvider>
          <PlayerProvider>
            <NoctyShell />
          </PlayerProvider>
        </NetworkModeProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
