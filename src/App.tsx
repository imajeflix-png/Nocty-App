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
  const { activeView, setActiveView, isZenMode, ambientPalette, toasts } = usePlayer();
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
      {/* Global Cover-Adaptive Ambient Light Orbs for iOS 26 Liquid Glass Refraction */}
      <div aria-hidden="true" className="ambient-aura-layer pointer-events-none fixed inset-0 overflow-hidden z-0">
        {/* Orb 1: Indigo Purple blended with active cover primary */}
        <div
          className="animate-orb-pulse absolute -top-36 -left-24 w-[68vw] h-[68vw] max-w-[780px] max-h-[780px] rounded-full blur-[120px] opacity-35 transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle, rgba(${Math.round(primary.r * 0.6 + 99 * 0.4)}, ${Math.round(primary.g * 0.6 + 102 * 0.4)}, ${Math.round(primary.b * 0.6 + 241 * 0.4)}, 0.95) 0%, rgba(79, 70, 229, 0.55) 45%, transparent 72%)`,
          }}
        />
        {/* Orb 2: Midnight Blue blended with active cover secondary */}
        <div
          className="animate-orb-pulse absolute top-1/4 -right-28 w-[62vw] h-[62vw] max-w-[720px] max-h-[720px] rounded-full blur-[120px] opacity-35 transition-colors duration-1000"
          style={{
            animationDelay: '3s',
            background: `radial-gradient(circle, rgba(${Math.round(secondary.r * 0.55 + 37 * 0.45)}, ${Math.round(secondary.g * 0.55 + 99 * 0.45)}, ${Math.round(secondary.b * 0.55 + 235 * 0.45)}, 0.92) 0%, rgba(30, 58, 138, 0.65) 48%, transparent 72%)`,
          }}
        />
        {/* Orb 3: Dim Crimson blended with active cover accent */}
        <div
          className="animate-orb-pulse absolute -bottom-36 left-1/4 w-[58vw] h-[58vw] max-w-[680px] max-h-[680px] rounded-full blur-[120px] opacity-35 transition-colors duration-1000"
          style={{
            animationDelay: '6s',
            background: `radial-gradient(circle, rgba(${Math.round(primary.r * 0.45 + 190 * 0.55)}, ${Math.round(primary.g * 0.45 + 24 * 0.55)}, ${Math.round(primary.b * 0.45 + 93 * 0.55)}, 0.85) 0%, rgba(136, 19, 55, 0.55) 48%, transparent 72%)`,
          }}
        />
      </div>

      {/* Minimal Top Bar */}
      <div className="relative z-10 shrink-0">
        <TopBar />
      </div>

      {/* Airy iOS 26 Liquid Glass Workspace */}
      <div className="relative z-10 flex-1 min-h-0 flex gap-3 px-3 pb-0 lg:pb-3">
        {/* Compact Frosted Glass Left Sidebar */}
        <Sidebar />

        {/* Spacious Crystal Liquid Glass Main View */}
        <main
          ref={mainScrollRef}
          {...touchHandlers}
          className="relative flex-1 min-w-0 h-full rounded-[28px] bg-white/[0.03] backdrop-blur-2xl backdrop-saturate-150 border border-white/[0.14] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),0_12px_32px_rgba(0,0,0,0.4)] overflow-y-auto overflow-x-hidden touch-pan-y scroll-pt-8"
        >
          {/* Soft Cover-Adaptive Ambient Aura inside Main View */}
          <div
            aria-hidden="true"
            className="ambient-aura-layer pointer-events-none absolute -top-24 inset-x-0 h-[400px] blur-[100px] transition-all duration-1000"
            style={{
              opacity: Math.min(0.45, Math.max(0.28, gradientIntensity * 0.85)),
              background: `
                radial-gradient(ellipse 65% 60% at 22% 15%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9) 0%, transparent 72%),
                radial-gradient(ellipse 55% 55% at 78% 10%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.85) 0%, transparent 70%)
              `,
            }}
          />

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
              className="px-4 py-2.5 rounded-2xl text-xs font-medium bg-white/[0.09] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.20] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] transition-all"
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
