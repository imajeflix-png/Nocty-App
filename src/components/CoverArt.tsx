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

  return (
    <div
      className={`relative overflow-hidden bg-[#181822] shrink-0 select-none ${
        spinning ? 'rounded-full' : roundedClass
      } ${className}`}
    >
      {hasError && effectiveSrc === DEFAULT_COVER_URL ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#121218] via-[#10B981]/20 to-[#A3E635]/15">
          <Disc3 className="w-1/2 h-1/2 text-emerald-400/70" strokeWidth={1.5} />
        </div>
      ) : (
        <img
          src={effectiveSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${
            spinning ? `animate-disc-spin ${isPlaying ? 'disc-running' : 'disc-paused'}` : ''
          }`}
        />
      )}
      {spinning && (
        <div
          aria-hidden="true"
          className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-[#0B0B0F] ring-1 ring-white/25 pointer-events-none"
        />
      )}
    </div>
  );
};
