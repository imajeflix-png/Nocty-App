import React, { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import {
  WHISPER_BADGE_EMOJI,
  WhisperPayload,
  decodeWhisperPayload,
  whisperToTrack,
} from '../utils/whisperUtils';
import { AppleEmoji } from './AppleEmoji';
import { CoverArt } from './CoverArt';

export const WhisperReceiverModal: React.FC = () => {
  const { playTrackAtTime, setIsZenMode, ambientPalette } = usePlayer();
  const [whisper, setWhisper] = useState<WhisperPayload | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('whisper');
    if (!token) return;

    const decoded = decodeWhisperPayload(token);
    if (decoded) {
      setWhisper(decoded);
    }
  }, []);

  if (!whisper) return null;

  const { primary, secondary } = ambientPalette;

  const clearWhisperUrlParam = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('whisper')) {
      url.searchParams.delete('whisper');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  };

  const handleDismiss = () => {
    clearWhisperUrlParam();
    setWhisper(null);
  };

  const handlePlayMoment = () => {
    const track = whisperToTrack(whisper);
    playTrackAtTime(track, whisper.startTime);
    setIsZenMode(true);
    clearWhisperUrlParam();
    setWhisper(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nocty Whisper diterima"
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#121216]/88 backdrop-blur-md border border-white/[0.14] shadow-[0_24px_64px_rgba(0,0,0,0.75)] overflow-hidden">
        {/* Soft Cover Ambient Mesh */}
        <div
          aria-hidden="true"
          className="ambient-aura-layer pointer-events-none absolute -top-24 inset-x-0 h-60 blur-3xl opacity-30"
          style={{
            background: `
              radial-gradient(circle at 25% 25%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.95) 0%, transparent 65%),
              radial-gradient(circle at 80% 70%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.85) 0%, transparent 65%)
            `,
          }}
        />

        <div className="relative z-10 p-6 space-y-5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/[0.10] text-xs font-medium text-white">
              <AppleEmoji unified="2728" size={14} />
              <span>Nocty Whisper</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.12] border border-white/[0.12] text-xs font-medium text-white">
                <AppleEmoji unified={WHISPER_BADGE_EMOJI[whisper.badge]} size={14} />
                <span>{whisper.badge}</span>
              </span>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Tutup Whisper"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/75 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.9} />
              </button>
            </div>
          </div>

          {/* Sender Info */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45 font-medium">
              Titipan Pesan Dari
            </p>
            <p className="mt-0.5 font-display text-lg font-bold text-white">
              {whisper.senderName}
            </p>
          </div>

          {/* Highlighted Lyric Snippet */}
          <div className="rounded-2xl bg-white/[0.06] border border-white/[0.10] p-4 space-y-2">
            {whisper.lines.length > 0 ? (
              whisper.lines.map((line, idx) => (
                <p
                  key={idx}
                  className="font-display text-base sm:text-lg font-bold leading-snug text-white"
                >
                  &ldquo;{line}&rdquo;
                </p>
              ))
            ) : (
              <p className="font-display text-base font-bold text-white">
                &ldquo;{whisper.track.title}&rdquo;
              </p>
            )}

            {whisper.message && (
              <p className="pt-2 border-t border-white/[0.08] text-xs sm:text-sm text-white/80 italic leading-relaxed">
                {whisper.message}
              </p>
            )}
          </div>

          {/* Track Summary */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/30 border border-white/[0.08]">
            <CoverArt
              src={whisper.track.coverUrl}
              alt={whisper.track.title}
              className="w-12 h-12 shrink-0"
              roundedClass="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{whisper.track.title}</p>
              <p className="text-xs text-white/60 truncate mt-0.5">{whisper.track.artist}</p>
            </div>
            {whisper.startTime > 0 && (
              <span className="font-mono-tabular text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/80 shrink-0">
                {formatDuration(whisper.startTime)}
              </span>
            )}
          </div>

          {/* Primary Action */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handlePlayMoment}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-[#0B0B0D] hover:bg-white/90 text-sm font-semibold transition-all shadow-[0_8px_28px_rgba(255,255,255,0.22)]"
            >
              <Play className="w-4 h-4 fill-[#0B0B0D]" strokeWidth={2} />
              <span>Putar Momen Ini</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 text-xs font-medium text-white/80 transition-colors"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
