import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface SyncedLyricsListProps {
  variant?: 'panel' | 'zen';
}

export const SyncedLyricsList: React.FC<SyncedLyricsListProps> = ({ variant = 'panel' }) => {
  const { currentTrack, currentTime, seekTo, lyricOffset, setLyricOffset } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimerRef = useRef<number | null>(null);

  const syncedLines = currentTrack?.lyrics || [];
  const adjustedTime = currentTime + lyricOffset;

  const activeIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= adjustedTime + 0.15) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [syncedLines, adjustedTime]);

  useEffect(() => {
    if (activeIndex < 0 || userScrolling) return;
    const el = lineRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, userScrolling]);

  useEffect(() => {
    setUserScrolling(false);
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentTrack?.id]);

  const handleManualScroll = () => {
    setUserScrolling(true);
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = window.setTimeout(() => {
      setUserScrolling(false);
    }, 3000);
  };

  const adjustOffset = (delta: number) => {
    setLyricOffset(Math.max(-5, Math.min(5, Math.round((lyricOffset + delta) * 10) / 10)));
  };

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <Mic2 className="w-8 h-8 text-white/25 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-white/85">Belum ada lagu diputar</p>
        <p className="mt-1 text-xs text-white/50">
          Putar lagu apa saja untuk menampilkan lirik sinkron otomatis.
        </p>
      </div>
    );
  }

  if (currentTrack.lyricsStatus === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <Loader2 className="w-7 h-7 text-white/75 animate-spin mb-3" strokeWidth={1.75} />
        <p className="text-sm text-white/55">Mengambil lirik sinkron...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Lyric Offset Control Bar */}
      {syncedLines.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02] shrink-0 text-xs text-white/60">
          <span>Geser Waktu Lirik</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => adjustOffset(-0.5)}
              aria-label="Kurangi offset 0.5 detik"
              title="Percepat lirik 0.5s"
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white text-xs font-mono-tabular transition-colors"
            >
              -0.5s
            </button>
            <span className="font-mono-tabular px-1.5 text-white/90">
              {lyricOffset > 0 ? `+${lyricOffset.toFixed(1)}s` : `${lyricOffset.toFixed(1)}s`}
            </span>
            <button
              type="button"
              onClick={() => adjustOffset(0.5)}
              aria-label="Tambah offset 0.5 detik"
              title="Lambatkan lirik 0.5s"
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-white text-xs font-mono-tabular transition-colors"
            >
              +0.5s
            </button>
          </div>
        </div>
      )}

      {syncedLines.length > 0 ? (
        <div
          ref={containerRef}
          onWheel={handleManualScroll}
          onTouchMove={handleManualScroll}
          className={`flex-1 min-h-0 overflow-y-auto scroll-smooth ${
            variant === 'zen' ? 'px-2 sm:px-6 py-12 space-y-5' : 'px-4 py-6 space-y-3'
          }`}
        >
          {syncedLines.map((line, index) => {
            const isCurrent = index === activeIndex;
            const isPast = activeIndex !== -1 && index < activeIndex;
            const distance = activeIndex === -1 ? 1 : Math.abs(index - activeIndex);

            const zenBlurClass =
              variant === 'zen'
                ? isCurrent
                  ? 'blur-0 opacity-100 scale-[1.02]'
                  : distance === 1
                    ? 'blur-[0.6px] opacity-55 hover:blur-0 hover:opacity-90'
                    : 'blur-[1.6px] opacity-30 hover:blur-0 hover:opacity-85'
                : isCurrent
                  ? 'opacity-100'
                  : isPast
                    ? 'opacity-35 hover:opacity-80'
                    : 'opacity-55 hover:opacity-95';

            return (
              <button
                key={`${index}-${line.time}`}
                ref={(el) => {
                  lineRefs.current[index] = el;
                }}
                type="button"
                onClick={() => {
                  setUserScrolling(false);
                  seekTo(Math.max(0, line.time - lyricOffset));
                }}
                className={`w-full text-left rounded-xl transition-all duration-300 origin-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  variant === 'zen' ? 'px-3 py-2' : 'px-2.5 py-1.5 hover:bg-white/[0.06]'
                } ${zenBlurClass}`}
              >
                <span
                  className={`block leading-snug transition-colors ${
                    variant === 'zen'
                      ? 'font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight'
                      : 'font-display text-[15px] sm:text-base font-semibold'
                  } ${isCurrent ? 'text-white drop-shadow-[0_2px_16px_rgba(255,255,255,0.28)]' : 'text-white/80'}`}
                >
                  {line.text}
                </span>
              </button>
            );
          })}
        </div>
      ) : currentTrack.plainLyrics ? (
        <div
          className={`flex-1 min-h-0 overflow-y-auto ${
            variant === 'zen' ? 'px-4 sm:px-8 py-14' : 'px-5 py-6'
          }`}
        >
          <p className="text-xs text-white/55 mb-4">
            Lirik teks penuh (timestamp sinkron belum tersedia)
          </p>
          <div
            className={`whitespace-pre-line leading-relaxed text-white/85 ${
              variant === 'zen' ? 'font-display text-xl sm:text-2xl font-semibold' : 'text-sm'
            }`}
          >
            {currentTrack.plainLyrics}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-12">
          <Mic2 className="w-8 h-8 text-white/25 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-white/85">Lirik belum tersedia</p>
          <p className="mt-1 text-xs text-white/50 max-w-xs leading-relaxed">
            LRCLIB belum memiliki lirik untuk &ldquo;{currentTrack.title}&rdquo;. Nikmati alunan musiknya.
          </p>
        </div>
      )}
    </div>
  );
};
