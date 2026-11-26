import React from 'react';
import { Heart, Loader2, Pause, Play } from 'lucide-react';
import { Track } from '../types/music';
import { usePlayer } from '../context/PlayerContext';
import { formatDuration } from '../utils/audioUtils';
import { CoverArt } from './CoverArt';
import { EqualizerBars } from './EqualizerBars';
import { TrackActionsMenu } from './TrackActionsMenu';

interface TrackRowProps {
  track: Track;
  index: number;
  contextTracks: Track[];
  lyricSnippet?: string;
  playlistIdContext?: string;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  contextTracks,
  lyricSnippet,
  playlistIdContext,
}) => {
  const { currentTrack, isPlaying, isBuffering, playTrack, toggleLike, isLiked } = usePlayer();

  const isActive = currentTrack?.id === track.id;
  const liked = isLiked(track.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => playTrack(track, contextTracks)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playTrack(track, contextTracks);
        }
      }}
      className={`group flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        isActive ? 'bg-white/10' : 'hover:bg-white/[0.05]'
      }`}
    >
      {/* Index or Playing Indicator */}
      <div className="hidden sm:flex w-6 items-center justify-center shrink-0">
        {isActive && isBuffering ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" strokeWidth={1.9} />
        ) : isActive && isPlaying ? (
          <EqualizerBars active={true} />
        ) : (
          <span className="font-mono-tabular text-xs text-white/35 group-hover:hidden">
            {(index + 1).toString().padStart(2, '0')}
          </span>
        )}
        {!(isActive && (isPlaying || isBuffering)) && (
          <Play
            className="hidden group-hover:block w-3.5 h-3.5 text-white fill-white"
            strokeWidth={1.75}
          />
        )}
      </div>

      {/* Cover with hover play/pause overlay */}
      <div className="relative shrink-0">
        <CoverArt
          src={track.coverUrl}
          alt={track.title}
          className="w-11 h-11 shadow-md shadow-black/40"
          roundedClass="rounded-lg"
        />
        <div
          className={`absolute inset-0 rounded-lg bg-black/55 flex items-center justify-center transition-opacity duration-150 ${
            isActive ? 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isActive && isBuffering ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" strokeWidth={2} />
          ) : isActive && isPlaying ? (
            <Pause className="w-4 h-4 text-white fill-white" strokeWidth={1.75} />
          ) : (
            <Play className="w-4 h-4 text-white fill-white" strokeWidth={1.75} />
          )}
        </div>
      </div>

      {/* Title, Artist & Optional Lyric Snippet */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-white font-semibold' : 'text-white/90'}`}>
            {track.title}
          </p>
          {isActive && (
            <span className="sm:hidden shrink-0">
              <EqualizerBars active={isPlaying} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/50 truncate">
          <span className="truncate">{track.artist}</span>
          {track.sourceType === 'local' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-white/65 shrink-0">Lokal</span>
            </>
          )}
          {track.isPreview && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-white/45 shrink-0">Preview 30d</span>
            </>
          )}
        </div>
        {lyricSnippet && (
          <p className="mt-1 text-xs text-white/70 italic truncate">
            &ldquo;{lyricSnippet}&rdquo;
          </p>
        )}
      </div>

      {/* Actions & Tabular Duration */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(track);
          }}
          aria-label={liked ? `Hapus ${track.title} dari disukai` : `Sukai ${track.title}`}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            liked
              ? 'text-white'
              : 'text-white/40 opacity-75 sm:opacity-0 group-hover:opacity-100 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} strokeWidth={1.85} />
        </button>

        <span className="font-mono-tabular text-xs text-white/45 w-11 text-right">
          {formatDuration(track.duration)}
        </span>

        <TrackActionsMenu track={track} playlistIdContext={playlistIdContext} />
      </div>
    </div>
  );
};
