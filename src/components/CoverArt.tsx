import React, { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { DEFAULT_COVER_URL } from '../data/moods';

interface CoverArtProps {
  src?: string;
  alt: string;
  className?: string;
  spinning?: boolean;
  isPlaying?: boolean;
  roundedClass?: string;
}

export const CoverArt: React.FC<CoverArtProps> = ({
  src,
  alt,
  className = 'w-12 h-12',
  spinning = false,
  isPlaying = false,
  roundedClass = 'rounded-xl',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const effectiveSrc = !hasError && src ? src : DEFAULT_COVER_URL;
  const isYtLetterboxedThumb = effectiveSrc.includes('i.ytimg.com/vi/') && effectiveSrc.includes('hqdefault');

  return (
    <div
      className={`relative aspect-square overflow-hidden bg-[#141418] shrink-0 select-none ${
        spinning ? 'rounded-full' : roundedClass
      } ${className}`}
    >
      {hasError && effectiveSrc === DEFAULT_COVER_URL ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent">
          <Disc3 className="w-1/2 h-1/2 text-white/45" strokeWidth={1.5} />
        </div>
      ) : (
        <img
          src={effectiveSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`w-full h-full aspect-square object-cover ${
            isYtLetterboxedThumb ? 'scale-[1.36]' : ''
          } ${
            spinning ? `animate-disc-spin ${isPlaying ? 'disc-running' : 'disc-paused'}` : ''
          }`}
        />
      )}
      {spinning && (
        <div
          aria-hidden="true"
          className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-[#050507] ring-1 ring-white/25 pointer-events-none"
        />
      )}
    </div>
  );
};
