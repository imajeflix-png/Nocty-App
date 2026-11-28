import React from 'react';
import { AudioWaveform, Settings, WifiOff } from 'lucide-react';
import { useNetworkMode } from '../context/NetworkModeContext';
import { usePlayer } from '../context/PlayerContext';

export const TopBar: React.FC = () => {
  const { mode: networkMode, acceptNormalMode } = useNetworkMode();
  const { activeView, setActiveView } = usePlayer();

  return (
    <header className="h-16 sm:h-[78px] sm:pt-4 shrink-0 px-4 sm:px-6 flex items-center justify-between gap-3 bg-transparent select-none">
      {/* Left: Clean Apple-Style Nocty Logo */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => setActiveView('home')}
          className="flex items-center gap-2.5 text-left rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <span className="w-8 h-8 rounded-xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] flex items-center justify-center">
            <AudioWaveform className="w-4 h-4 text-white" strokeWidth={2.1} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            Nocty
          </span>
        </button>
      </div>

      {/* Right: Optional Lite Mode status + Glass Settings Gear Icon */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {networkMode === 'lite' && (
          <button
            type="button"
            onClick={acceptNormalMode}
            title="Mode Ringan Aktif — klik untuk kembali ke Mode Normal"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-amber-400/15 hover:bg-amber-400/25 backdrop-blur-2xl border border-amber-300/35 text-amber-200 transition-colors whitespace-nowrap shrink-0"
          >
            <WifiOff className="w-3 h-3 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Mode Ringan</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveView(activeView === 'settings' ? 'home' : 'settings')}
          aria-pressed={activeView === 'settings'}
          aria-label="Pengaturan Nocty"
          title="Pengaturan"
          className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-2xl transition-all active:scale-95 shrink-0 ${
            activeView === 'settings'
              ? 'bg-white text-[#0B0B0D] border-white/40'
              : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-white/85 hover:text-white'
          }`}
        >
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.9} />
        </button>
      </div>
    </header>
  );
};
