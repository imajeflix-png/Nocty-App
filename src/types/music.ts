export type TrackSourceType = 'online' | 'local' | 'preview';

export interface LyricLine {
  time: number;
  text: string;
}

export interface Track {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  coverUrl: string;
  audioUrl?: string;
  fallbackAudioUrls?: string[];
  sourceType: TrackSourceType;
  isPreview?: boolean;
  lyrics: LyricLine[];
  plainLyrics?: string;
  lyricsStatus?: 'idle' | 'loading' | 'loaded' | 'empty' | 'error';
  createdAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
}

export type LoopMode = 'off' | 'all' | 'one';

export type NavView = 'home' | 'explore' | 'liked' | 'playlist' | 'library' | 'local';

export type RightPanelTab = 'queue' | 'lyrics' | null;

export interface AmbientColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface AmbientPalette {
  primary: AmbientColor;
  secondary: AmbientColor;
}

export interface MoodCategory {
  id: string;
  label: string;
  subtitle: string;
  query: string;
  coverUrl: string;
  accentHex: string;
}
