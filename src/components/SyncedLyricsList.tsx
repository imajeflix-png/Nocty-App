import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface SyncedLyricsListProps {
  variant?: 'panel' | 'zen';
}

export const SyncedLyricsList: React.FC<SyncedLyricsListProps> = ({ variant = 'panel' }) => {
  const { currentTrack, currentTime, seekTo } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimerRef = useRef<number | null>(null);

  const syncedLines = currentTrack?.lyrics || [];

  const activeIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= currentTime + 0.15) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [syncedLines, currentTime]);

  // Smoothly center the active lyric line whenever it advances
  useEffect(() => {
    if (activeIndex < 0 || userScrolling) return;
    const el = lineRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, userScrolling]);

  // Reset refs & scroll when track changes
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

  if (!currentTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <Mic2 className="w-8 h-8 text-[#5B6070] mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-[#F4F4F6]">Belum ada lagu diputar</p>
        <p className="mt-1 text-xs text-[#9499A6]">
          Putar lagu apa saja untuk menampilkan lirik sinkron otomatis.
        </p>
      </div>
    );
  }

  if (currentTrack.lyricsStatus === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <Loader2 className="w-7 h-7 text-emerald-400 animate-spin mb-3" strokeWidth={1.75} />
        <p className="text-sm text-[#9499A6]">Mengambil lirik sinkron dari LRCLIB...</p>
      </div>
    );
  }

  if (syncedLines.length > 0) {
    return (
      <div
        ref={containerRef}
        onWheel={handleManualScroll}
        onTouchMove={handleManualScroll}
        className={`h-full overflow-y-auto scroll-smooth ${
          variant === 'zen' ? 'px-2 sm:px-6 py-24 space-y-5' : 'px-4 py-10 space-y-3'
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
                  ? 'opacity-40 hover:opacity-80'
                  : 'opacity-65 hover:opacity-95';

          return (
            <button
              key={`${index}-${line.time}`}
              ref={(el) => {
                lineRefs.current[index] = el;
              }}
              type="button"
              onClick={() => {
                setUserScrolling(false);
                seekTo(line.time);
              }}
              className={`w-full text-left rounded-xl transition-all duration-300 origin-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                variant === 'zen' ? 'px-3 py-2' : 'px-2.5 py-1.5 hover:bg-white/[0.04]'
              } ${zenBlurClass}`}
            >
              <span
                className={`block leading-snug transition-colors ${
                  variant === 'zen'
                    ? 'font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight'
                    : 'font-display text-[15px] sm:text-base font-semibold'
                } ${
                  isCurrent
                    ? 'text-neon-gradient'
                    : 'text-[#E4E6EC]'
                }`}
              >
                {line.text}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (currentTrack.plainLyrics) {
    return (
      <div
        className={`h-full overflow-y-auto ${
          variant === 'zen' ? 'px-4 sm:px-8 py-16' : 'px-5 py-6'
        }`}
      >
        <p className="text-xs text-emerald-400/80 mb-4">
          Lirik teks penuh (timestamp sinkron belum tersedia)
        </p>
        <div
          className={`whitespace-pre-line leading-relaxed text-[#E4E6EC]/90 ${
            variant === 'zen' ? 'font-display text-xl sm:text-2xl font-semibold' : 'text-sm'
          }`}
        >
          {currentTrack.plainLyrics}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
      <Mic2 className="w-8 h-8 text-[#5B6070] mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-[#F4F4F6]">Lirik belum tersedia</p>
      <p className="mt-1 text-xs text-[#9499A6] max-w-xs leading-relaxed">
        LRCLIB belum memiliki lirik untuk &ldquo;{currentTrack.title}&rdquo;. Nikmati alunan musiknya!
      </p>
    </div>
  );
};
