import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AmbientColor,
  AmbientPalette,
  LoopMode,
  NavView,
  Playlist,
  RightPanelTab,
  Track,
} from '../types/music';
import { DEFAULT_COVER_URL, EMERGENCY_FALLBACK_TRACKS } from '../data/moods';
import {
  ListeningHistoryEntry,
  deleteLocalTrackFromDb,
  extractLocalFileDuration,
  getAllLocalTracksFromDb,
  loadAmbientVideoPref,
  loadAutoplayPref,
  loadLikedIdsFromStorage,
  loadListeningHistory,
  loadPlayerPrefs,
  loadPlaylistsFromStorage,
  loadSavedTracksFromStorage,
  parseFileNameMeta,
  saveAmbientVideoPref,
  saveAutoplayPref,
  saveLikedIdsToStorage,
  saveListeningHistory,
  saveLocalTrackToDb,
  savePlayerPrefs,
  savePlaylistsToStorage,
  saveSavedTracksToStorage,
} from '../services/storageDb';
import {
  fetchCuratedFeeds,
  isPreviewAudioUrl,
  resolveFullStream,
  resolveYouTubeMusicVideoId,
  searchOnlineTracks,
  searchYouTubeTracks,
} from '../services/musicApi';
import { fetchSyncedLyrics } from '../services/lrclibApi';
import {
  DEFAULT_AMBIENT_PALETTE,
  TrackMoodInfo,
  detectTrackMood,
  extractCoverAmbientPalette,
  generateSquircleArtworkDataUrl,
  mixTracksByMood,
  smartShuffleTracks,
} from '../utils/audioUtils';
import { generateSimulatedWeeklyHistory } from '../utils/weeklyAuraUtils';

interface YTPlayerInstance {
  loadVideoById: (arg: string | { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: string | HTMLElement,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number; target: YTPlayerInstance }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

interface DynamicIslandPluginBridge {
  updateState?: (options: {
    title: string;
    artist: string;
    isPlaying: boolean;
    artwork: string;
  }) => Promise<{ canDrawOverlays?: boolean }>;
  hide?: () => Promise<void>;
  checkOverlayPermission?: () => Promise<{ granted: boolean }>;
  requestOverlayPermission?: () => Promise<void>;
  addListener?: (
    eventName: 'islandAction',
    listenerFunc: (data: { action: string }) => void
  ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => void };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        DynamicIsland?: DynamicIslandPluginBridge;
      };
    };
  }
}

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success';
}

type PlaybackEngine = 'youtube' | 'html5' | null;
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface PlayerContextValue {
  // Navigation & Global Search
  activeView: NavView;
  setActiveView: (view: NavView) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedPlaylistId: string | null;
  openPlaylist: (playlistId: string) => void;
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanelTab: (tab: Exclude<RightPanelTab, null>) => void;
  isZenMode: boolean;
  setIsZenMode: (value: boolean) => void;
  isCreatePlaylistOpen: boolean;
  setIsCreatePlaylistOpen: (open: boolean) => void;

  // Library & Collections
  localTracks: Track[];
  trackRegistry: Record<string, Track>;
  registerTracks: (tracks: Track[]) => void;
  playlists: Playlist[];
  likedIds: string[];
  likedTracks: Track[];
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  toggleLike: (track: Track) => void;
  isLiked: (trackId: string) => boolean;
  uploadLocalFiles: (files: FileList | File[], targetPlaylistId?: string) => Promise<void>;
  deleteLocalTrack: (trackId: string) => Promise<void>;

  // Home & Explore Dynamic Curated Feeds
  featuredTracks: Track[];
  indonesiaTrending: Track[];
  viralTracks: Track[];
  indieRnbTracks: Track[];
  isTrendingLoading: boolean;
  refreshTrending: () => Promise<void>;

  // Active Playback & Queue
  currentTrack: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  loopMode: LoopMode;
  queueIds: string[];
  queueTracks: Track[];
  currentIndex: number;
  currentMood: TrackMoodInfo | null;
  ambientColor: AmbientColor;
  ambientPalette: AmbientPalette;

  // Player Actions
  playTrack: (
    track: Track,
    contextTracks?: Track[],
    options?: { preserveOrder?: boolean }
  ) => void;
  playTrackAtTime: (track: Track, startSeconds?: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleLoopMode: () => void;
  addToQueue: (track: Track, playNextPosition?: boolean) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearUpcomingQueue: () => void;

  // Sleep Timer
  sleepTimerRemaining: number | null;
  sleepTimerMode: 'off' | 'countdown' | 'end_of_track';
  setSleepTimerMinutes: (minutes: number) => void;
  setSleepTimerEndOfTrack: () => void;
  cancelSleepTimer: () => void;

  // Ambient Video Backdrop
  activeEngine: PlaybackEngine;
  ambientVideoId: string | null;
  isAmbientVideoEnabled: boolean;
  setIsAmbientVideoEnabled: (enabled: boolean) => void;
  toggleAmbientVideo: () => void;

  // Cross-fade Audio Transitions
  crossfadeDuration: number;
  setCrossfadeDuration: (seconds: number) => void;
  cycleCrossfadeDuration: () => void;

  // Autoplay Radio Stream
  isAutoplayEnabled: boolean;
  toggleAutoplay: () => void;

  // Synced Lyrics Offset
  lyricOffset: number;
  setLyricOffset: (offset: number | ((prev: number) => number)) => void;

  // PWA Install Prompt
  isInstallable: boolean;
  promptInstallApp: () => Promise<void>;

  // Social Modals (Lyric Whisper, 9:16 Share Card & Weekly Aura)
  isWhisperComposerOpen: boolean;
  setIsWhisperComposerOpen: (open: boolean) => void;
  isLyricCardOpen: boolean;
  setIsLyricCardOpen: (open: boolean) => void;
  isWeeklyAuraOpen: boolean;
  setIsWeeklyAuraOpen: (open: boolean) => void;
  isTwinModalOpen: boolean;
  setIsTwinModalOpen: (open: boolean) => void;
  listeningHistory: ListeningHistoryEntry[];
  simulateWeeklyAuraData: () => void;

  // System Auto-Theme & Dynamic Theme Sync
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  cycleThemeMode: () => void;
  isDynamicThemeSync: boolean;
  toggleDynamicThemeSync: () => void;

  // Notifications
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: ToastMessage['tone']) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

let ytScriptPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytScriptPromise) return ytScriptPromise;

  ytScriptPromise = new Promise<void>((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      resolve();
    };

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return ytScriptPromise;
}

function interleaveTracks(lists: Track[][], maxItems = 24): Track[] {
  const result: Track[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...lists.map((l) => l.length));

  for (let i = 0; i < maxLen && result.length < maxItems; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
      if (result.length >= maxItems) break;
    }
  }
  return result;
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPrefs = useMemo(() => loadPlayerPrefs(), []);

  // Views & UI Panels — always launch on Home with Right Panel CLOSED
  const [activeView, setActiveView] = useState<NavView>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);

  // Library & Collections
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [trackRegistry, setTrackRegistry] = useState<Record<string, Track>>(() => {
    const saved = loadSavedTracksFromStorage();
    const map: Record<string, Track> = { ...saved };
    for (const t of EMERGENCY_FALLBACK_TRACKS) {
      if (!map[t.id]) map[t.id] = t;
    }
    return map;
  });
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylistsFromStorage());
  const [likedIds, setLikedIds] = useState<string[]>(() => loadLikedIdsFromStorage());

  // Home & Explore Dynamic Curated Feeds
  const [featuredTracks, setFeaturedTracks] = useState<Track[]>([]);
  const [indonesiaTrending, setIndonesiaTrending] = useState<Track[]>([]);
  const [viralTracks, setViralTracks] = useState<Track[]>([]);
  const [indieRnbTracks, setIndieRnbTracks] = useState<Track[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);

  // Audio & Queue State
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<PlaybackEngine>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialPrefs.volume);
  const [isMuted, setIsMuted] = useState(initialPrefs.isMuted);
  const [isShuffled, setIsShuffled] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>(initialPrefs.loopMode);
  const [originalQueueIds, setOriginalQueueIds] = useState<string[]>([]);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [extractedPalette, setExtractedPalette] =
    useState<AmbientPalette>(DEFAULT_AMBIENT_PALETTE);
  const [isDynamicThemeSync, setIsDynamicThemeSync] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nocty_dynamic_theme_sync');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [sleepTimerMode, setSleepTimerMode] = useState<'off' | 'countdown' | 'end_of_track'>('off');
  const [isAmbientVideoEnabled, setIsAmbientVideoEnabled] = useState<boolean>(() =>
    loadAmbientVideoPref()
  );
  const [crossfadeDuration, setCrossfadeDurationState] = useState<number>(
    initialPrefs.crossfadeDuration
  );
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState<boolean>(() => loadAutoplayPref());
  const [lyricOffset, setLyricOffset] = useState<number>(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [activeYtDeck, setActiveYtDeck] = useState<0 | 1>(0);
  const [isWhisperComposerOpen, setIsWhisperComposerOpen] = useState(false);
  const [isLyricCardOpen, setIsLyricCardOpen] = useState(false);
  const [isWeeklyAuraOpen, setIsWeeklyAuraOpen] = useState(false);
  const [isTwinModalOpen, setIsTwinModalOpen] = useState(false);
  const [ambientVideoId, setAmbientVideoId] = useState<string | null>(null);
  const [listeningHistory, setListeningHistory] = useState<ListeningHistoryEntry[]>(() =>
    loadListeningHistory()
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('nocty_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // Ignore storage access error
    }
    return 'system';
  });
  const [osPrefersDark, setOsPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Dual Audio Engine Pools (2 YouTube IFrame Decks + 2 HTML5 <audio> Elements for true overlapping cross-fade)
  const html5PoolRef = useRef<[HTMLAudioElement | null, HTMLAudioElement | null]>([null, null]);
  const activeHtml5SlotRef = useRef<0 | 1>(0);
  const html5FadeTimersRef = useRef<[number | null, number | null]>([null, null]);
  const html5FadeGainRef = useRef<[number, number]>([1, 1]);

  const ytDeckWrapperRefs = useRef<[HTMLDivElement | null, HTMLDivElement | null]>([null, null]);
  const ytPlayersRef = useRef<[YTPlayerInstance | null, YTPlayerInstance | null]>([null, null]);
  const ytReadyRef = useRef<[boolean, boolean]>([false, false]);
  const activeYtDeckRef = useRef<0 | 1>(0);
  const pendingYtVideoIdsRef = useRef<[(string | { videoId: string; startSeconds?: number }) | null, (string | { videoId: string; startSeconds?: number }) | null]>([null, null]);
  const ytFadeTimersRef = useRef<[number | null, number | null]>([null, null]);
  const ytFadeGainRef = useRef<[number, number]>([1, 1]);
  const ytFadingInPendingRef = useRef<[number | null, number | null]>([null, null]);

  const activeEngineRef = useRef<PlaybackEngine>(null);
  const lastManualSeekAtRef = useRef<number>(0);
  const pendingInitialSeekRef = useRef<{ seq: number; seconds: number } | null>(null);
  const sleepTimerEndAtRef = useRef<number | null>(null);
  const sleepTimeoutRef = useRef<number | null>(null);
  const sleepTimerModeRef = useRef<'off' | 'countdown' | 'end_of_track'>('off');
  sleepTimerModeRef.current = sleepTimerMode;

  const playRequestSeqRef = useRef(0);
  const crossfadeTriggeredSeqRef = useRef<number>(-1);
  const fallbackAttemptIndexRef = useRef<number>(0);
  const ytAltTriedRef = useRef<Record<string, boolean>>({});
  const consecutiveErrorSkipsRef = useRef(0);
  const lyricsAbortRef = useRef<AbortController | null>(null);
  const moodMixSeqRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const transitionLockTimerRef = useRef<number | null>(null);

  const trackRegistryRef = useRef(trackRegistry);
  trackRegistryRef.current = trackRegistry;
  const originalQueueIdsRef = useRef(originalQueueIds);
  originalQueueIdsRef.current = originalQueueIds;
  const queueIdsRef = useRef(queueIds);
  queueIdsRef.current = queueIds;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const currentTrackIdRef = useRef(currentTrackId);
  currentTrackIdRef.current = currentTrackId;
  const isShuffledRef = useRef(isShuffled);
  isShuffledRef.current = isShuffled;
  const loopModeRef = useRef(loopMode);
  loopModeRef.current = loopMode;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const crossfadeDurationRef = useRef(crossfadeDuration);
  crossfadeDurationRef.current = crossfadeDuration;
  const isAutoplayEnabledRef = useRef(isAutoplayEnabled);
  isAutoplayEnabledRef.current = isAutoplayEnabled;
  const listeningHistoryRef = useRef(listeningHistory);
  listeningHistoryRef.current = listeningHistory;

  const listeningSessionRef = useRef<{
    trackId: string;
    title: string;
    artist: string;
    artwork: string;
    accumulatedSeconds: number;
    startedAt: number;
    recordedTimestamp: number | null;
  } | null>(null);

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const acquireTransitionLock = useCallback((durationMs = 1500): boolean => {
    if (isTransitioningRef.current) return false;
    isTransitioningRef.current = true;
    if (transitionLockTimerRef.current !== null) {
      window.clearTimeout(transitionLockTimerRef.current);
    }
    transitionLockTimerRef.current = window.setTimeout(() => {
      isTransitioningRef.current = false;
      transitionLockTimerRef.current = null;
    }, durationMs);
    return true;
  }, []);

  const releaseTransitionLock = useCallback(() => {
    isTransitioningRef.current = false;
    if (transitionLockTimerRef.current !== null) {
      window.clearTimeout(transitionLockTimerRef.current);
      transitionLockTimerRef.current = null;
    }
  }, []);

  const getResolvedCurrentIndex = useCallback((queue: string[], curId: string | null): number => {
    if (queue.length === 0) return -1;
    const refIdx = currentIndexRef.current;
    if (refIdx >= 0 && refIdx < queue.length && queue[refIdx] === curId) {
      return refIdx;
    }
    return curId ? queue.indexOf(curId) : -1;
  }, []);

  useEffect(() => {
    return () => {
      if (transitionLockTimerRef.current !== null) {
        window.clearTimeout(transitionLockTimerRef.current);
      }
    };
  }, []);

  const registerTracks = useCallback((tracks: Track[]) => {
    if (!tracks.length) return;
    setTrackRegistry((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of tracks) {
        const existing = prev[t.id];
        if (!existing) {
          next[t.id] = t;
          changed = true;
        } else if (
          t.sourceType === 'local' ||
          (!existing.videoId && t.videoId) ||
          (!existing.audioUrl && t.audioUrl) ||
          (existing.lyrics.length === 0 && t.lyrics.length > 0)
        ) {
          next[t.id] = {
            ...existing,
            ...t,
            videoId: t.videoId || existing.videoId,
            lyrics: t.lyrics.length > 0 ? t.lyrics : existing.lyrics,
            lyricsStatus:
              t.lyrics.length > 0 ? 'loaded' : existing.lyricsStatus || t.lyricsStatus,
          };
          changed = true;
        }
      }
      if (changed) {
        trackRegistryRef.current = next;
        return next;
      }
      return prev;
    });
  }, []);

  // System Auto-Theme: listen for OS color-scheme changes & sync root classes
  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? (osPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updatePref = (e?: MediaQueryListEvent) => {
      setOsPrefersDark(e ? e.matches : media.matches);
    };
    updatePref();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updatePref);
      return () => media.removeEventListener('change', updatePref);
    }
    media.addListener(updatePref);
    return () => media.removeListener(updatePref);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolvedTheme === 'dark' ? '#0B0B0D' : '#F2F4F8');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem('nocty_theme_mode', themeMode);
    } catch {
      // Ignore storage error
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem('nocty_dynamic_theme_sync', String(isDynamicThemeSync));
    } catch {
      // Ignore storage error
    }
  }, [isDynamicThemeSync]);

  const toggleDynamicThemeSync = useCallback(() => {
    setIsDynamicThemeSync((prev) => {
      const next = !prev;
      pushToast(
        next ? 'Dynamic Theme Sync aktif' : 'Dynamic Theme Sync dimatikan',
        'info'
      );
      return next;
    });
  }, [pushToast]);

  const cycleThemeMode = useCallback(() => {
    setThemeMode((prev) => {
      const next: ThemeMode = prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system';
      const label =
        next === 'system'
          ? 'Tema: Mengikuti Sistem OS'
          : next === 'light'
            ? 'Tema: Mode Terang'
            : 'Tema: Mode Gelap';
      pushToast(label, 'info');
      return next;
    });
  }, [pushToast]);

  useEffect(() => {
    savePlaylistsToStorage(playlists);
  }, [playlists]);

  useEffect(() => {
    saveLikedIdsToStorage(likedIds);
  }, [likedIds]);

  useEffect(() => {
    savePlayerPrefs({ volume, isMuted, isShuffled, loopMode, crossfadeDuration });
  }, [volume, isMuted, isShuffled, loopMode, crossfadeDuration]);

  useEffect(() => {
    saveAmbientVideoPref(isAmbientVideoEnabled);
  }, [isAmbientVideoEnabled]);

  useEffect(() => {
    saveAutoplayPref(isAutoplayEnabled);
  }, [isAutoplayEnabled]);

  const toggleAmbientVideo = useCallback(() => {
    setIsAmbientVideoEnabled((prev) => {
      const next = !prev;
      pushToast(next ? 'Ambient Video aktif' : 'Ambient Video dimatikan', 'info');
      return next;
    });
  }, [pushToast]);

  const toggleAutoplay = useCallback(() => {
    setIsAutoplayEnabled((prev) => {
      const next = !prev;
      pushToast(next ? 'Autoplay Radio Stream aktif' : 'Autoplay dimatikan', 'info');
      return next;
    });
  }, [pushToast]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const promptInstallApp = useCallback(async () => {
    if (!deferredPrompt) {
      pushToast('Aplikasi sudah ter-install atau tidak didukung browser ini.', 'info');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      pushToast('Terima kasih telah meng-install Nocty!', 'success');
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  }, [deferredPrompt, pushToast]);



  const setCrossfadeDuration = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(12, Math.round(seconds)));
      setCrossfadeDurationState(clamped);
      pushToast(
        clamped > 0 ? `Cross-fade diatur: ${clamped} detik` : 'Cross-fade dimatikan',
        'info'
      );
    },
    [pushToast]
  );

  const cycleCrossfadeDuration = useCallback(() => {
    const steps = [0, 3, 5, 8];
    setCrossfadeDurationState((prev) => {
      const idx = steps.indexOf(prev);
      const next = steps[(idx + 1) % steps.length];
      pushToast(
        next > 0 ? `Cross-fade diatur: ${next} detik` : 'Cross-fade dimatikan',
        'info'
      );
      return next;
    });
  }, [pushToast]);

  useEffect(() => {
    const referencedIds = new Set<string>(likedIds);
    for (const pl of playlists) {
      for (const tid of pl.trackIds) referencedIds.add(tid);
    }
    const toPersist: Record<string, Track> = {};
    for (const id of referencedIds) {
      const t = trackRegistry[id];
      if (t && t.sourceType !== 'local') {
        toPersist[id] = t;
      }
    }
    saveSavedTracksToStorage(toPersist);
  }, [playlists, likedIds, trackRegistry]);

  useEffect(() => {
    let active = true;
    getAllLocalTracksFromDb().then((tracks) => {
      if (!active || tracks.length === 0) return;
      setLocalTracks(tracks);
      registerTracks(tracks);
    });
    return () => {
      active = false;
    };
  }, [registerTracks]);

  const refreshTrending = useCallback(async () => {
    setIsTrendingLoading(true);
    const controller = new AbortController();

    try {
      let { indonesia, global, viral, indieRnb } = await fetchCuratedFeeds(controller.signal).catch(
        () => ({ indonesia: [], global: [], viral: [], indieRnb: [] })
      );

      if (indonesia.length === 0 || global.length === 0) {
        const [indoFallback, globalFallback, viralFallback, indieFallback] = await Promise.allSettled([
          indonesia.length
            ? Promise.resolve({ tracks: indonesia })
            : searchOnlineTracks('Tulus Hindia Bernadya Nadhif Basalamah', controller.signal, 20),
          global.length
            ? Promise.resolve({ tracks: global })
            : searchOnlineTracks('The Weeknd Coldplay Bruno Mars Billie Eilish', controller.signal, 20),
          viral.length
            ? Promise.resolve({ tracks: viral })
            : searchOnlineTracks('viral tiktok hits 2026', controller.signal, 20),
          indieRnb.length
            ? Promise.resolve({ tracks: indieRnb })
            : searchOnlineTracks('Hindia Reality Club Daniel Caesar SZA', controller.signal, 20),
        ]);

        if (indonesia.length === 0 && indoFallback.status === 'fulfilled') {
          indonesia = indoFallback.value.tracks;
        }
        if (global.length === 0 && globalFallback.status === 'fulfilled') {
          global = globalFallback.value.tracks;
        }
        if (viral.length === 0 && viralFallback.status === 'fulfilled') {
          viral = viralFallback.value.tracks;
        }
        if (indieRnb.length === 0 && indieFallback.status === 'fulfilled') {
          indieRnb = indieFallback.value.tracks;
        }
      }

      if (indonesia.length === 0 && global.length === 0) {
        indonesia = EMERGENCY_FALLBACK_TRACKS;
        global = [...EMERGENCY_FALLBACK_TRACKS].reverse();
      }

      const combined = interleaveTracks([indonesia, global, viral, indieRnb], 48);
      registerTracks(combined);
      setIndonesiaTrending(indonesia);
      setFeaturedTracks(global.length ? global : indonesia);
      setViralTracks(viral.length ? viral : global);
      setIndieRnbTracks(indieRnb.length ? indieRnb : indonesia);

      if (queueIdsRef.current.length === 0) {
        const initialIds = combined.map((t) => t.id);
        originalQueueIdsRef.current = initialIds;
        queueIdsRef.current = initialIds;
        setOriginalQueueIds(initialIds);
        setQueueIds(initialIds);
      }
    } catch {
      registerTracks(EMERGENCY_FALLBACK_TRACKS);
      setFeaturedTracks(EMERGENCY_FALLBACK_TRACKS);
      setIndonesiaTrending([...EMERGENCY_FALLBACK_TRACKS].reverse());
      setViralTracks(EMERGENCY_FALLBACK_TRACKS);
      setIndieRnbTracks(EMERGENCY_FALLBACK_TRACKS);
    } finally {
      setIsTrendingLoading(false);
    }
  }, [registerTracks]);

  useEffect(() => {
    refreshTrending();
  }, [refreshTrending]);

  const currentTrack = useMemo(
    () => (currentTrackId ? trackRegistry[currentTrackId] || null : null),
    [currentTrackId, trackRegistry]
  );

  const currentMood = useMemo(
    () => (currentTrack ? detectTrackMood(currentTrack) : null),
    [currentTrack]
  );

  const lastMediaSessionPosRef = useRef<{
    trackId: string | null;
    sec: number;
    dur: number;
    playing: boolean;
  }>({ trackId: null, sec: -1, dur: 0, playing: false });

  // Web Media Session API integration (512x512 squircle artwork + responsive system/TWS controls)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      lastMediaSessionPosRef.current = { trackId: null, sec: -1, dur: 0, playing: false };
      return;
    }

    let cancelled = false;
    const baseArt = currentTrack.coverUrl;
    const buildMetadata = (artworkSrc: string, mimeType: string) =>
      new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'Nocty Music',
        artwork: [
          { src: artworkSrc, sizes: '128x128', type: mimeType },
          { src: artworkSrc, sizes: '256x256', type: mimeType },
          { src: artworkSrc, sizes: '512x512', type: mimeType },
        ],
      });

    navigator.mediaSession.metadata = buildMetadata(baseArt, 'image/jpeg');

    generateSquircleArtworkDataUrl(baseArt, 512).then((squircleUrl) => {
      if (cancelled || !squircleUrl || squircleUrl === baseArt) return;
      try {
        navigator.mediaSession.metadata = buildMetadata(squircleUrl, 'image/png');
      } catch {
        // Ignore if metadata update rejected
      }
    });

    const registerHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported MediaSessionAction in older browsers
      }
    };

    registerHandler('play', () => {
      if (!isPlayingRef.current) togglePlayPauseRef.current();
    });
    registerHandler('pause', () => {
      if (isPlayingRef.current) togglePlayPauseRef.current();
    });
    registerHandler('stop', () => {
      if (isPlayingRef.current) togglePlayPauseRef.current();
    });
    registerHandler('previoustrack', () => playPrevRef.current());
    registerHandler('nexttrack', () => playNextRef.current());
    registerHandler('seekbackward', (details) => {
      seekToRef.current(Math.max(0, currentTimeRef.current - (details.seekOffset || 10)));
    });
    registerHandler('seekforward', (details) => {
      seekToRef.current(currentTimeRef.current + (details.seekOffset || 10));
    });
    registerHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seekToRef.current(details.seekTime);
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.coverUrl]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying
        ? 'playing'
        : currentTrack
          ? 'paused'
          : 'none';

      if (
        currentTrack &&
        'setPositionState' in navigator.mediaSession &&
        duration > 0 &&
        Number.isFinite(currentTime)
      ) {
        const flooredSec = Math.floor(Math.max(0, Math.min(currentTime, duration)));
        const roundedDur = Math.round(duration);
        const prev = lastMediaSessionPosRef.current;

        const shouldSync =
          prev.trackId !== currentTrack.id ||
          prev.sec !== flooredSec ||
          Math.abs(prev.dur - roundedDur) >= 1 ||
          prev.playing !== isPlaying;

        if (shouldSync) {
          lastMediaSessionPosRef.current = {
            trackId: currentTrack.id,
            sec: flooredSec,
            dur: roundedDur,
            playing: isPlaying,
          };
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, duration),
            playbackRate: 1,
            position: Math.max(0, Math.min(flooredSec, duration)),
          });
        }
      }
    } catch {
      // Ignore
    }
  }, [currentTime, duration, isPlaying, currentTrack]);

  // Native Android Dynamic Island Floating Overlay & Media Foreground Service bridge (Capacitor)
  useEffect(() => {
    const cap = window.Capacitor;
    const islandPlugin = cap?.Plugins?.DynamicIsland;
    if (!cap?.isNativePlatform?.() || !islandPlugin?.addListener) return;

    let disposed = false;
    let activeHandle: { remove?: () => Promise<void> | void } | null = null;

    const maybePromise = islandPlugin.addListener('islandAction', ({ action }) => {
      if (action === 'togglePlay') {
        togglePlayPauseRef.current();
      } else if (action === 'play') {
        if (!isPlayingRef.current) togglePlayPauseRef.current();
      } else if (action === 'pause') {
        if (isPlayingRef.current) togglePlayPauseRef.current();
      } else if (action === 'next') {
        playNextRef.current();
      } else if (action === 'prev') {
        playPrevRef.current();
      }
    });

    Promise.resolve(maybePromise)
      .then((handle) => {
        if (disposed) {
          handle?.remove?.();
        } else {
          activeHandle = handle;
        }
      })
      .catch(() => {
        // Ignore bridge listener failure
      });

    return () => {
      disposed = true;
      try {
        activeHandle?.remove?.();
      } catch {
        // Ignore cleanup failure
      }
    };
  }, []);

  useEffect(() => {
    const cap = window.Capacitor;
    const islandPlugin = cap?.Plugins?.DynamicIsland;
    if (!cap?.isNativePlatform?.() || !islandPlugin) return;

    if (!currentTrack) {
      islandPlugin.hide?.().catch(() => {});
      return;
    }

    islandPlugin
      .updateState?.({
        title: currentTrack.title,
        artist: currentTrack.artist,
        isPlaying,
        artwork: currentTrack.coverUrl,
      })
      .catch(() => {});
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.artist, currentTrack?.coverUrl, isPlaying]);

  const ambientPalette = useMemo<AmbientPalette>(
    () => (isDynamicThemeSync ? extractedPalette : DEFAULT_AMBIENT_PALETTE),
    [extractedPalette, isDynamicThemeSync]
  );

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    extractCoverAmbientPalette(currentTrack.coverUrl, currentTrack.id).then((palette) => {
      if (cancelled) return;
      setExtractedPalette(palette);
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.coverUrl]);

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(
      '--ambient-rgb',
      `${ambientPalette.primary.r}, ${ambientPalette.primary.g}, ${ambientPalette.primary.b}`
    );
    rootStyle.setProperty(
      '--ambient-secondary-rgb',
      `${ambientPalette.secondary.r}, ${ambientPalette.secondary.g}, ${ambientPalette.secondary.b}`
    );
    rootStyle.setProperty('--accent-hex', ambientPalette.primary.hex);
    rootStyle.setProperty('--accent-contrast', ambientPalette.accentContrast);
    rootStyle.setProperty(
      '--bg-gradient-intensity',
      String(ambientPalette.gradientIntensity)
    );
  }, [ambientPalette]);

  useEffect(() => {
    if (!currentTrack) return;
    if (currentTrack.lyricsStatus === 'loaded' || currentTrack.lyrics.length > 0) return;

    lyricsAbortRef.current?.abort();
    const controller = new AbortController();
    lyricsAbortRef.current = controller;

    const targetId = currentTrack.id;
    setTrackRegistry((prev) => {
      const t = prev[targetId];
      if (!t) return prev;
      return { ...prev, [targetId]: { ...t, lyricsStatus: 'loading' } };
    });

    fetchSyncedLyrics(currentTrack.artist, currentTrack.title, currentTrack.duration, controller.signal)
      .then(({ synced, plain }) => {
        if (controller.signal.aborted) return;
        setTrackRegistry((prev) => {
          const t = prev[targetId];
          if (!t) return prev;
          return {
            ...prev,
            [targetId]: {
              ...t,
              lyrics: synced,
              plainLyrics: plain,
              lyricsStatus: synced.length > 0 || plain ? 'loaded' : 'empty',
            },
          };
        });
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setTrackRegistry((prev) => {
          const t = prev[targetId];
          if (!t) return prev;
          return { ...prev, [targetId]: { ...t, lyricsStatus: 'error' } };
        });
      });

    return () => controller.abort();
  }, [currentTrack?.id]);

  // Resolve real moving YouTube Music Video ID for Ambient Video Backdrop
  useEffect(() => {
    if (!currentTrack || currentTrack.sourceType === 'local' || !isAmbientVideoEnabled) {
      setAmbientVideoId(null);
      return;
    }

    setAmbientVideoId(currentTrack.videoId || null);
    const controller = new AbortController();

    resolveYouTubeMusicVideoId(currentTrack.artist, currentTrack.title, controller.signal)
      .then((mvId) => {
        if (!controller.signal.aborted && mvId) {
          setAmbientVideoId(mvId);
        }
      })
      .catch(() => {
        // Keep fallback videoId if available
      });

    return () => controller.abort();
  }, [currentTrack?.id, currentTrack?.videoId, currentTrack?.sourceType, isAmbientVideoEnabled]);

  // Silent Listening History Tracker (>20s per play stored to nocty_listening_history)
  const flushListeningSession = useCallback(() => {
    const session = listeningSessionRef.current;
    if (!session || session.accumulatedSeconds < 20) return;

    const entryTimestamp = session.recordedTimestamp ?? session.startedAt;
    session.recordedTimestamp = entryTimestamp;

    const updatedEntry: ListeningHistoryEntry = {
      trackId: session.trackId,
      title: session.title,
      artist: session.artist,
      artwork: session.artwork,
      durationListened: Math.round(session.accumulatedSeconds),
      timestamp: entryTimestamp,
    };

    setListeningHistory((prev) => {
      const idx = prev.findIndex(
        (item) => item.trackId === updatedEntry.trackId && item.timestamp === entryTimestamp
      );
      const next =
        idx !== -1
          ? prev.map((item, i) => (i === idx ? updatedEntry : item))
          : [...prev, updatedEntry];
      saveListeningHistory(next);
      return next;
    });
  }, []);

  useEffect(() => {
    flushListeningSession();
    if (!currentTrack) {
      listeningSessionRef.current = null;
      return;
    }
    listeningSessionRef.current = {
      trackId: currentTrack.id,
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: currentTrack.coverUrl,
      accumulatedSeconds: 0,
      startedAt: Date.now(),
      recordedTimestamp: null,
    };
  }, [currentTrack?.id, flushListeningSession]);

  useEffect(() => {
    if (!isPlaying || !currentTrack) {
      flushListeningSession();
      return;
    }

    const interval = window.setInterval(() => {
      const session = listeningSessionRef.current;
      if (!session || session.trackId !== currentTrack.id) return;
      session.accumulatedSeconds += 1;

      if (
        session.accumulatedSeconds === 20 ||
        (session.accumulatedSeconds > 20 && session.accumulatedSeconds % 10 === 0)
      ) {
        flushListeningSession();
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPlaying, currentTrack?.id, flushListeningSession]);

  const simulateWeeklyAuraData = useCallback(() => {
    const seedPool = [
      ...indonesiaTrending,
      ...featuredTracks,
      ...viralTracks,
      ...indieRnbTracks,
    ];
    const simulated = generateSimulatedWeeklyHistory(seedPool);
    setListeningHistory(simulated);
    saveListeningHistory(simulated);
    pushToast('Data simulasi Weekly Aura minggu ini dibuat', 'success');
  }, [featuredTracks, indieRnbTracks, indonesiaTrending, pushToast, viralTracks]);

  const clearYtFade = useCallback((deckIdx: 0 | 1) => {
    const timer = ytFadeTimersRef.current[deckIdx];
    if (timer !== null) {
      window.clearInterval(timer);
      ytFadeTimersRef.current[deckIdx] = null;
    }
    ytFadingInPendingRef.current[deckIdx] = null;
  }, []);

  const clearHtml5Fade = useCallback((slotIdx: 0 | 1) => {
    const timer = html5FadeTimersRef.current[slotIdx];
    if (timer !== null) {
      window.clearInterval(timer);
      html5FadeTimersRef.current[slotIdx] = null;
    }
  }, []);

  const applyYtDeckGain = useCallback((deckIdx: 0 | 1, gain01: number) => {
    ytFadeGainRef.current[deckIdx] = Math.max(0, Math.min(1, gain01));
    const player = ytPlayersRef.current[deckIdx];
    if (!player || !ytReadyRef.current[deckIdx]) return;
    try {
      const baseVol = isMutedRef.current ? 0 : volumeRef.current;
      const effective = Math.max(0, Math.min(1, ytFadeGainRef.current[deckIdx])) * baseVol;
      player.setVolume(Math.round(effective * 100));
      if (effective <= 0.001) {
        player.mute();
      } else {
        player.unMute();
      }
    } catch {
      // Ignore if YT player not ready
    }
  }, []);

  const applyHtml5SlotGain = useCallback((slotIdx: 0 | 1, gain01: number) => {
    html5FadeGainRef.current[slotIdx] = Math.max(0, Math.min(1, gain01));
    const audio = html5PoolRef.current[slotIdx];
    if (!audio) return;
    const baseVol = isMutedRef.current ? 0 : volumeRef.current;
    audio.volume = Math.max(0, Math.min(1, html5FadeGainRef.current[slotIdx])) * baseVol;
  }, []);

  const fadeOutYtDeck = useCallback(
    (deckIdx: 0 | 1, durationMs: number) => {
      clearYtFade(deckIdx);
      const player = ytPlayersRef.current[deckIdx];
      if (!player || !ytReadyRef.current[deckIdx]) return;

      if (durationMs <= 60) {
        try {
          player.pauseVideo();
        } catch {
          // Ignore
        }
        applyYtDeckGain(deckIdx, 1);
        return;
      }

      const startGain = ytFadeGainRef.current[deckIdx] || 1;
      const startedAt = Date.now();
      ytFadeTimersRef.current[deckIdx] = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(1, elapsed / durationMs);
        const gain = startGain * Math.cos(progress * Math.PI * 0.5);
        applyYtDeckGain(deckIdx, gain);

        if (progress >= 1) {
          clearYtFade(deckIdx);
          try {
            ytPlayersRef.current[deckIdx]?.pauseVideo();
          } catch {
            // Ignore
          }
          applyYtDeckGain(deckIdx, 1);
        }
      }, 50);
    },
    [applyYtDeckGain, clearYtFade]
  );

  const fadeInYtDeck = useCallback(
    (deckIdx: 0 | 1, durationMs: number) => {
      clearYtFade(deckIdx);
      if (durationMs <= 60) {
        applyYtDeckGain(deckIdx, 1);
        return;
      }

      applyYtDeckGain(deckIdx, 0.03);
      const startedAt = Date.now();
      ytFadeTimersRef.current[deckIdx] = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(1, elapsed / durationMs);
        const gain = Math.sin(progress * Math.PI * 0.5);
        applyYtDeckGain(deckIdx, gain);

        if (progress >= 1) {
          clearYtFade(deckIdx);
          applyYtDeckGain(deckIdx, 1);
        }
      }, 50);
    },
    [applyYtDeckGain, clearYtFade]
  );

  const fadeOutHtml5Slot = useCallback(
    (slotIdx: 0 | 1, durationMs: number) => {
      clearHtml5Fade(slotIdx);
      const audio = html5PoolRef.current[slotIdx];
      if (!audio) return;

      if (durationMs <= 60 || audio.paused) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        applyHtml5SlotGain(slotIdx, 1);
        return;
      }

      const startGain = html5FadeGainRef.current[slotIdx] || 1;
      const startedAt = Date.now();
      html5FadeTimersRef.current[slotIdx] = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(1, elapsed / durationMs);
        const gain = startGain * Math.cos(progress * Math.PI * 0.5);
        applyHtml5SlotGain(slotIdx, gain);

        if (progress >= 1) {
          clearHtml5Fade(slotIdx);
          const target = html5PoolRef.current[slotIdx];
          if (target) {
            target.pause();
            target.removeAttribute('src');
            target.load();
          }
          applyHtml5SlotGain(slotIdx, 1);
        }
      }, 50);
    },
    [applyHtml5SlotGain, clearHtml5Fade]
  );

  const fadeInHtml5Slot = useCallback(
    (slotIdx: 0 | 1, durationMs: number) => {
      clearHtml5Fade(slotIdx);
      if (durationMs <= 60) {
        applyHtml5SlotGain(slotIdx, 1);
        return;
      }

      applyHtml5SlotGain(slotIdx, 0.03);
      const startedAt = Date.now();
      html5FadeTimersRef.current[slotIdx] = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(1, elapsed / durationMs);
        const gain = Math.sin(progress * Math.PI * 0.5);
        applyHtml5SlotGain(slotIdx, gain);

        if (progress >= 1) {
          clearHtml5Fade(slotIdx);
          applyHtml5SlotGain(slotIdx, 1);
        }
      }, 50);
    },
    [applyHtml5SlotGain, clearHtml5Fade]
  );

  const advanceQueueOnEndOrSkipRef = useRef<() => void>(() => {});
  const startPlaybackRef = useRef<
    (
      track: Track,
      isAutoRecovery?: boolean,
      transitionMode?: 'direct' | 'skip' | 'auto',
      startSeconds?: number
    ) => Promise<void>
  >(async () => {});

  const startPlaybackForTrack = useCallback(
    async (
      track: Track,
      isAutoRecovery = false,
      transitionMode: 'direct' | 'skip' | 'auto' = 'direct',
      startSeconds = 0
    ) => {
      const reqSeq = ++playRequestSeqRef.current;
      crossfadeTriggeredSeqRef.current = -1;
      fallbackAttemptIndexRef.current = 0;
      const safeStart = startSeconds > 0 && Number.isFinite(startSeconds) ? startSeconds : 0;
      pendingInitialSeekRef.current = safeStart > 0 ? { seq: reqSeq, seconds: safeStart } : null;
      if (!isAutoRecovery) {
        consecutiveErrorSkipsRef.current = 0;
      }

      const prevEngine = activeEngineRef.current;
      const prevYtDeck = activeYtDeckRef.current;
      const prevHtml5Slot = activeHtml5SlotRef.current;

      const cfSeconds = crossfadeDurationRef.current;
      const shouldCrossfade = !isAutoRecovery && cfSeconds > 0 && isPlayingRef.current;
      const fadeOutMs = !shouldCrossfade
        ? 0
        : transitionMode === 'auto'
          ? cfSeconds * 1000
          : Math.min(cfSeconds * 1000, 1600);
      const fadeInMs = !shouldCrossfade
        ? 0
        : transitionMode === 'auto'
          ? cfSeconds * 1000
          : Math.min(cfSeconds * 1000, 1400);

      currentTrackIdRef.current = track.id;
      setCurrentTrackId(track.id);
      setCurrentTime(safeStart);
      const hasFullMetaDuration =
        Number.isFinite(track.duration) &&
        track.duration > 35 &&
        !isPreviewAudioUrl(track.audioUrl);
      setDuration(hasFullMetaDuration ? track.duration : 0);
      setIsBuffering(true);

      // Local MP3s play directly via HTML5 <audio> pool
      if (track.sourceType === 'local') {
        const nextSlot: 0 | 1 =
          prevEngine === 'html5' ? (prevHtml5Slot === 0 ? 1 : 0) : prevHtml5Slot;
        const incomingAudio = html5PoolRef.current[nextSlot];

        // Ensure no lingering 3rd track keeps playing if user skips rapidly
        const otherYtDeck: 0 | 1 = prevYtDeck === 0 ? 1 : 0;
        fadeOutYtDeck(otherYtDeck, 0);
        if (prevEngine === 'youtube') {
          fadeOutYtDeck(prevYtDeck, fadeOutMs);
        } else {
          fadeOutYtDeck(prevYtDeck, 0);
        }
        if (prevEngine === 'html5' && prevHtml5Slot !== nextSlot) {
          fadeOutHtml5Slot(prevHtml5Slot, fadeOutMs);
        }

        activeEngineRef.current = 'html5';
        setActiveEngine('html5');
        activeHtml5SlotRef.current = nextSlot;
        pendingYtVideoIdsRef.current = [null, null];

        clearHtml5Fade(nextSlot);
        if (!incomingAudio || !track.audioUrl) {
          setIsBuffering(false);
          setIsPlaying(false);
          return;
        }

        try {
          applyHtml5SlotGain(nextSlot, fadeInMs > 0 ? 0.03 : 1);
          incomingAudio.src = track.audioUrl;
          incomingAudio.load();
          if (safeStart > 0) {
            incomingAudio.currentTime = safeStart;
          }
          await incomingAudio.play();
          if (safeStart > 0 && Math.abs(incomingAudio.currentTime - safeStart) > 1.2) {
            incomingAudio.currentTime = safeStart;
          }
          pendingInitialSeekRef.current = null;
          if (playRequestSeqRef.current === reqSeq) {
            setIsPlaying(true);
            setIsBuffering(false);
            consecutiveErrorSkipsRef.current = 0;
            fadeInHtml5Slot(nextSlot, fadeInMs);
          }
        } catch {
          if (playRequestSeqRef.current === reqSeq) {
            setIsPlaying(false);
            setIsBuffering(false);
          }
        }
        return;
      }

      // Online tracks (including Search Results): ALWAYS resolve full stream via YouTube first,
      // never playing a 30s previewUrl unless all full-stream resolvers fail.
      const resolved = await resolveFullStream(track);
      if (playRequestSeqRef.current !== reqSeq) return;

      const videoId = resolved.videoId;
      if (videoId) {
        setTrackRegistry((prev) => {
          const existing = prev[track.id];
          const nextDuration =
            resolved.duration && resolved.duration > 45
              ? resolved.duration
              : existing?.duration || track.duration;
          return {
            ...prev,
            [track.id]: {
              ...(existing || track),
              videoId,
              duration: nextDuration,
              isPreview: false,
            },
          };
        });
        if (resolved.duration && resolved.duration > 45) {
          setDuration(resolved.duration);
        }

        const candidateDeck: 0 | 1 =
          prevEngine === 'youtube' ? (prevYtDeck === 0 ? 1 : 0) : prevYtDeck;
        const nextDeck: 0 | 1 =
          ytReadyRef.current[candidateDeck] || !ytReadyRef.current[prevYtDeck]
            ? candidateDeck
            : prevYtDeck;

        // Silence older HTML5 slot or fade out active HTML5 slot when cross-fading across engines
        const otherHtml5Slot: 0 | 1 = prevHtml5Slot === 0 ? 1 : 0;
        fadeOutHtml5Slot(otherHtml5Slot, 0);
        if (prevEngine === 'html5') {
          fadeOutHtml5Slot(prevHtml5Slot, fadeOutMs);
        } else {
          fadeOutHtml5Slot(prevHtml5Slot, 0);
        }

        if (prevEngine === 'youtube' && prevYtDeck !== nextDeck) {
          fadeOutYtDeck(prevYtDeck, fadeOutMs);
        }

        activeEngineRef.current = 'youtube';
        setActiveEngine('youtube');
        activeYtDeckRef.current = nextDeck;
        setActiveYtDeck(nextDeck);

        clearYtFade(nextDeck);

        const ytLoadArg = safeStart > 0 ? { videoId, startSeconds: safeStart } : videoId;
        if (ytReadyRef.current[nextDeck] && ytPlayersRef.current[nextDeck]) {
          pendingYtVideoIdsRef.current[nextDeck] = null;
          if (fadeInMs > 0) {
            applyYtDeckGain(nextDeck, 0.03);
            ytFadingInPendingRef.current[nextDeck] = fadeInMs;
          } else {
            applyYtDeckGain(nextDeck, 1);
            ytFadingInPendingRef.current[nextDeck] = null;
          }
          ytPlayersRef.current[nextDeck]!.loadVideoById(ytLoadArg);
        } else {
          pendingYtVideoIdsRef.current[nextDeck] = ytLoadArg;
          ytFadingInPendingRef.current[nextDeck] = fadeInMs > 0 ? fadeInMs : null;
          loadYouTubeIframeApi();
        }
        return;
      }

      // Fallback HTML5 <audio>: full JioSaavn stream or 30s previewUrl as absolute last resort
      const nextSlot: 0 | 1 =
        prevEngine === 'html5' ? (prevHtml5Slot === 0 ? 1 : 0) : prevHtml5Slot;
      const incomingAudio = html5PoolRef.current[nextSlot];

      const otherYtDeck: 0 | 1 = prevYtDeck === 0 ? 1 : 0;
      fadeOutYtDeck(otherYtDeck, 0);
      if (prevEngine === 'youtube') {
        fadeOutYtDeck(prevYtDeck, fadeOutMs);
      } else {
        fadeOutYtDeck(prevYtDeck, 0);
      }
      if (prevEngine === 'html5' && prevHtml5Slot !== nextSlot) {
        fadeOutHtml5Slot(prevHtml5Slot, fadeOutMs);
      }

      activeEngineRef.current = 'html5';
      setActiveEngine('html5');
      activeHtml5SlotRef.current = nextSlot;
      pendingYtVideoIdsRef.current = [null, null];

      const srcUrl = resolved.audioUrl || track.audioUrl || track.fallbackAudioUrls?.[0];
      clearHtml5Fade(nextSlot);
      if (!incomingAudio || !srcUrl) {
        setIsBuffering(false);
        setIsPlaying(false);
        return;
      }

      if (resolved.isPreviewFallback) {
        setTrackRegistry((prev) => {
          const existing = prev[track.id];
          return {
            ...prev,
            [track.id]: { ...(existing || track), isPreview: true },
          };
        });
      }

      try {
        applyHtml5SlotGain(nextSlot, fadeInMs > 0 ? 0.03 : 1);
        incomingAudio.src = srcUrl;
        incomingAudio.load();
        if (safeStart > 0) {
          incomingAudio.currentTime = safeStart;
        }
        await incomingAudio.play();
        if (safeStart > 0 && Math.abs(incomingAudio.currentTime - safeStart) > 1.2) {
          incomingAudio.currentTime = safeStart;
        }
        pendingInitialSeekRef.current = null;
        if (playRequestSeqRef.current === reqSeq) {
          setIsPlaying(true);
          setIsBuffering(false);
          consecutiveErrorSkipsRef.current = 0;
          fadeInHtml5Slot(nextSlot, fadeInMs);
        }
      } catch {
        if (playRequestSeqRef.current === reqSeq) {
          setIsPlaying(false);
          setIsBuffering(false);
        }
      }
    },
    [
      applyHtml5SlotGain,
      applyYtDeckGain,
      clearHtml5Fade,
      clearYtFade,
      fadeInHtml5Slot,
      fadeOutHtml5Slot,
      fadeOutYtDeck,
    ]
  );

  startPlaybackRef.current = startPlaybackForTrack;

  const triggerEndOfTrackCrossfade = useCallback(() => {
    if (crossfadeTriggeredSeqRef.current === playRequestSeqRef.current) return;
    if (sleepTimerModeRef.current === 'end_of_track') return;
    if (loopModeRef.current === 'one') return;

    const q = queueIdsRef.current;
    const curId = currentTrackIdRef.current;
    if (!curId || q.length === 0) return;

    const idx = getResolvedCurrentIndex(q, curId);
    let nextIdx = -1;
    if (idx !== -1 && idx + 1 < q.length) {
      nextIdx = idx + 1;
    } else if (loopModeRef.current === 'all' && q.length > 0) {
      nextIdx = 0;
    }

    const nextId = nextIdx !== -1 ? q[nextIdx] : undefined;
    if (!nextId || nextId === curId) return;
    const nextTrack = trackRegistryRef.current[nextId];
    if (!nextTrack) return;

    if (!acquireTransitionLock(1500)) return;
    crossfadeTriggeredSeqRef.current = playRequestSeqRef.current;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    currentTrackIdRef.current = nextTrack.id;
    startPlaybackRef.current(nextTrack, false, 'auto');
  }, [acquireTransitionLock, getResolvedCurrentIndex]);

  useEffect(() => {
    advanceQueueOnEndOrSkipRef.current = () => {
      if (sleepTimerModeRef.current === 'end_of_track') {
        sleepTimerModeRef.current = 'off';
        sleepTimerEndAtRef.current = null;
        setSleepTimerMode('off');
        setSleepTimerRemaining(null);
        setIsPlaying(false);
        setIsBuffering(false);
        pushToast('Sleep timer selesai — pemutaran dijeda', 'info');
        return;
      }

      const mode = loopModeRef.current;
      const q = queueIdsRef.current;
      const curId = currentTrackIdRef.current;

      if (mode === 'one' && curId) {
        if (activeEngineRef.current === 'youtube') {
          const deck = ytPlayersRef.current[activeYtDeckRef.current];
          if (deck) {
            lastManualSeekAtRef.current = Date.now();
            setCurrentTime(0);
            deck.seekTo(0, true);
            deck.playVideo();
            return;
          }
        }
        if (activeEngineRef.current === 'html5') {
          const audio = html5PoolRef.current[activeHtml5SlotRef.current];
          if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
            return;
          }
        }
      }

      // 1.5s debounce/lock prevents duplicate YT.PlayerState.ENDED + HTML5 onEnded double-skips
      if (!acquireTransitionLock(1500)) return;

      const idx = getResolvedCurrentIndex(q, curId);
      if (idx !== -1 && idx + 1 < q.length) {
        const nextIdx = idx + 1;
        const nextTrack = trackRegistryRef.current[q[nextIdx]];
        if (nextTrack) {
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          currentTrackIdRef.current = nextTrack.id;
          startPlaybackRef.current(nextTrack, false, 'auto');
          return;
        }
      }

      if (mode === 'all' && q.length > 0) {
        const firstTrack = trackRegistryRef.current[q[0]];
        if (firstTrack) {
          currentIndexRef.current = 0;
          setCurrentIndex(0);
          currentTrackIdRef.current = firstTrack.id;
          startPlaybackRef.current(firstTrack, false, 'auto');
          return;
        }
      }

      if (isAutoplayEnabledRef.current && curId) {
        const currentTrackObj = trackRegistryRef.current[curId];
        if (currentTrackObj) {
          const anchorMood = detectTrackMood(currentTrackObj);
          setIsBuffering(true);
          searchOnlineTracks(
            `${anchorMood.autoplayHint} ${currentTrackObj.artist}`,
            undefined,
            20
          )
            .then(({ tracks }) => {
              const fresh = tracks.filter((t) => !queueIdsRef.current.includes(t.id));
              if (fresh.length > 0) {
                registerTracks(fresh);
                const moodOrdered = mixTracksByMood(currentTrackObj, fresh).filter(
                  (t) => t.id !== currentTrackObj.id
                );
                const orderedFresh = isShuffledRef.current
                  ? smartShuffleTracks(
                      moodOrdered,
                      listeningHistoryRef.current,
                      currentTrackObj
                    )
                  : moodOrdered;
                const newIds = orderedFresh.map((t) => t.id);
                const prevLen = queueIdsRef.current.length;
                const nextOrig = [...originalQueueIdsRef.current, ...moodOrdered.map((t) => t.id)];
                const nextQ = [...queueIdsRef.current, ...newIds];
                originalQueueIdsRef.current = nextOrig;
                queueIdsRef.current = nextQ;
                setOriginalQueueIds(nextOrig);
                setQueueIds(nextQ);
                const nextId = newIds[0];
                const nextTrack = trackRegistryRef.current[nextId];
                if (nextTrack) {
                  currentIndexRef.current = prevLen;
                  setCurrentIndex(prevLen);
                  currentTrackIdRef.current = nextTrack.id;
                  startPlaybackRef.current(nextTrack, false, 'auto');
                  pushToast(
                    `Autoplay (${anchorMood.label}): ${nextTrack.title}`,
                    'info'
                  );
                  return;
                }
              }
              setIsPlaying(false);
              setIsBuffering(false);
            })
            .catch(() => {
              setIsPlaying(false);
              setIsBuffering(false);
            });
          return;
        }
      }

      setIsPlaying(false);
      setIsBuffering(false);
    };
  }, [acquireTransitionLock, getResolvedCurrentIndex, pushToast, registerTracks]);

  // Initialize Dual YouTube IFrame Players (Deck 0 & Deck 1) ONCE using isolated slot elements
  useEffect(() => {
    let mounted = true;

    loadYouTubeIframeApi().then(() => {
      const YT = window.YT;
      if (!mounted || !YT?.Player) return;

      ([0, 1] as const).forEach((deckIdx) => {
        const host = ytDeckWrapperRefs.current[deckIdx];
        if (!host) return;

        const slot = document.createElement('div');
        host.innerHTML = '';
        host.appendChild(slot);

        const player = new YT.Player(slot, {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (!mounted) return;
              ytPlayersRef.current[deckIdx] = event.target;
              ytReadyRef.current[deckIdx] = true;

              const pendingVid = pendingYtVideoIdsRef.current[deckIdx];
              if (
                activeEngineRef.current === 'youtube' &&
                activeYtDeckRef.current === deckIdx &&
                pendingVid
              ) {
                pendingYtVideoIdsRef.current[deckIdx] = null;
                const pendingFadeMs = ytFadingInPendingRef.current[deckIdx];
                applyYtDeckGain(deckIdx, pendingFadeMs ? 0.03 : 1);
                event.target.loadVideoById(pendingVid);
              } else {
                applyYtDeckGain(deckIdx, 1);
              }
            },
            onStateChange: (event) => {
              if (
                !mounted ||
                activeEngineRef.current !== 'youtube' ||
                activeYtDeckRef.current !== deckIdx
              ) {
                return;
              }
              const YTState = window.YT?.PlayerState;
              if (!YTState) return;

              if (event.data === YTState.BUFFERING) {
                setIsBuffering(true);
              } else if (event.data === YTState.PLAYING) {
                setIsPlaying(true);
                setIsBuffering(false);
                consecutiveErrorSkipsRef.current = 0;

                const pendingFadeMs = ytFadingInPendingRef.current[deckIdx];
                if (pendingFadeMs && pendingFadeMs > 0) {
                  ytFadingInPendingRef.current[deckIdx] = null;
                  fadeInYtDeck(deckIdx, pendingFadeMs);
                }

                const pendingSeek = pendingInitialSeekRef.current;
                if (pendingSeek && pendingSeek.seq === playRequestSeqRef.current) {
                  pendingInitialSeekRef.current = null;
                  try {
                    const curNow = event.target.getCurrentTime?.() || 0;
                    if (Math.abs(curNow - pendingSeek.seconds) > 1.5) {
                      lastManualSeekAtRef.current = Date.now();
                      setCurrentTime(pendingSeek.seconds);
                      event.target.seekTo(pendingSeek.seconds, true);
                    }
                  } catch {
                    // Ignore
                  }
                }

                try {
                  const dur = event.target.getDuration?.();
                  const cur = event.target.getCurrentTime?.();
                  if (Number.isFinite(dur) && dur > 0) {
                    setDuration(dur);
                    const activeId = currentTrackIdRef.current;
                    if (activeId && dur > 35) {
                      const roundedDur = Math.round(dur);
                      setTrackRegistry((prev) => {
                        const existing = prev[activeId];
                        if (!existing) return prev;
                        if (existing.duration === roundedDur && !existing.isPreview) return prev;
                        return {
                          ...prev,
                          [activeId]: {
                            ...existing,
                            duration: roundedDur,
                            isPreview: false,
                          },
                        };
                      });
                    }
                  }
                  if (
                    Number.isFinite(cur) &&
                    cur >= 0 &&
                    Date.now() - lastManualSeekAtRef.current > 350
                  ) {
                    setCurrentTime(cur);
                  }
                } catch {
                  // Ignore
                }
              } else if (event.data === YTState.PAUSED) {
                setIsPlaying(false);
                setIsBuffering(false);
              } else if (event.data === YTState.ENDED) {
                advanceQueueOnEndOrSkipRef.current();
              }
            },
            onError: async () => {
              if (
                !mounted ||
                activeEngineRef.current !== 'youtube' ||
                activeYtDeckRef.current !== deckIdx
              ) {
                return;
              }
              const curId = currentTrackIdRef.current;
              const curTrack = curId ? trackRegistryRef.current[curId] : null;

              // Silent recovery 1: search an alternate full embeddable lyric/audio video for the same song
              if (curTrack && !ytAltTriedRef.current[curTrack.id]) {
                ytAltTriedRef.current[curTrack.id] = true;
                try {
                  const alts = await searchYouTubeTracks(
                    `${curTrack.title} ${curTrack.artist} lyrics`,
                    undefined,
                    6
                  );
                  const alt =
                    alts.find(
                      (a) => a.videoId && a.videoId !== curTrack.videoId && a.duration >= 45
                    ) || alts.find((a) => a.videoId && a.videoId !== curTrack.videoId);
                  if (alt?.videoId && currentTrackIdRef.current === curTrack.id) {
                    setTrackRegistry((prev) => ({
                      ...prev,
                      [curTrack.id]: {
                        ...curTrack,
                        videoId: alt.videoId,
                        duration: alt.duration >= 45 ? alt.duration : curTrack.duration,
                        isPreview: false,
                      },
                    }));
                    ytPlayersRef.current[deckIdx]?.loadVideoById(alt.videoId);
                    return;
                  }
                } catch {
                  // Continue to fallback
                }
              }

              // Silent recovery 2: fall back to direct full HTML5 audioUrl (or previewUrl only as final resort)
              if (curTrack?.audioUrl) {
                const slot = activeHtml5SlotRef.current;
                activeEngineRef.current = 'html5';
                setActiveEngine('html5');
                const audio = html5PoolRef.current[slot];
                if (audio) {
                  applyHtml5SlotGain(slot, 1);
                  audio.src = curTrack.audioUrl;
                  audio.load();
                  audio.play().catch(() => {
                    setIsPlaying(false);
                    setIsBuffering(false);
                  });
                  return;
                }
              }

              // Silent recovery 3: advance cleanly to next track (bounded)
              if (consecutiveErrorSkipsRef.current < 3) {
                consecutiveErrorSkipsRef.current += 1;
                const q = queueIdsRef.current;
                const idx = getResolvedCurrentIndex(q, curId);
                if (idx !== -1 && idx + 1 < q.length) {
                  const nextIdx = idx + 1;
                  const nextTrack = trackRegistryRef.current[q[nextIdx]];
                  if (nextTrack) {
                    currentIndexRef.current = nextIdx;
                    setCurrentIndex(nextIdx);
                    startPlaybackRef.current(nextTrack, true, 'direct');
                    return;
                  }
                }
              }

              setIsPlaying(false);
              setIsBuffering(false);
            },
          },
        });

        ytPlayersRef.current[deckIdx] = player;
      });
    });

    return () => {
      mounted = false;
      ([0, 1] as const).forEach((deckIdx) => {
        clearYtFade(deckIdx);
        try {
          ytPlayersRef.current[deckIdx]?.destroy?.();
        } catch {
          // Ignore cleanup errors
        }
        ytPlayersRef.current[deckIdx] = null;
        ytReadyRef.current[deckIdx] = false;
      });
    };
  }, [applyHtml5SlotGain, applyYtDeckGain, clearYtFade, fadeInYtDeck, getResolvedCurrentIndex]);

  // Active 200ms polling loop for active YouTube deck currentTime, duration, synced lyrics & auto cross-fade
  useEffect(() => {
    if (activeEngine !== 'youtube' || (!isPlaying && !isBuffering)) return;

    const timer = window.setInterval(() => {
      const deckIdx = activeYtDeckRef.current;
      const player = ytPlayersRef.current[deckIdx];
      if (!player || !ytReadyRef.current[deckIdx] || activeEngineRef.current !== 'youtube') return;

      try {
        const state = player.getPlayerState?.();
        const YTState = window.YT?.PlayerState;
        if (YTState && state === YTState.PLAYING) {
          setIsPlaying(true);
          setIsBuffering(false);

          const pendingFadeMs = ytFadingInPendingRef.current[deckIdx];
          if (pendingFadeMs && pendingFadeMs > 0) {
            ytFadingInPendingRef.current[deckIdx] = null;
            fadeInYtDeck(deckIdx, pendingFadeMs);
          }
        }

        const dur = player.getDuration?.();
        if (Number.isFinite(dur) && dur > 0) {
          setDuration(dur);
          const activeId = currentTrackIdRef.current;
          if (activeId && dur > 35) {
            const roundedDur = Math.round(dur);
            setTrackRegistry((prev) => {
              const existing = prev[activeId];
              if (!existing) return prev;
              if (existing.duration === roundedDur && !existing.isPreview) return prev;
              return {
                ...prev,
                [activeId]: {
                  ...existing,
                  duration: roundedDur,
                  isPreview: false,
                },
              };
            });
          }
        }

        const cur = player.getCurrentTime?.();
        if (
          Number.isFinite(cur) &&
          cur >= 0 &&
          Date.now() - lastManualSeekAtRef.current > 350
        ) {
          setCurrentTime(cur);

          const cf = crossfadeDurationRef.current;
          if (
            cf > 0 &&
            YTState &&
            state === YTState.PLAYING &&
            Number.isFinite(dur) &&
            dur >= cf * 2.2 &&
            dur - cur <= cf &&
            dur - cur > 0.25
          ) {
            triggerEndOfTrackCrossfade();
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [activeEngine, isPlaying, isBuffering, fadeInYtDeck, triggerEndOfTrackCrossfade]);

  // Initialize Dual HTML5 <audio> Pool (Slot 0 & Slot 1) for overlapping MP3/stream cross-fades
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    ([0, 1] as const).forEach((slotIdx) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = isMutedRef.current ? 0 : volumeRef.current;
      html5PoolRef.current[slotIdx] = audio;

      const isActiveSlot = () =>
        activeEngineRef.current === 'html5' && activeHtml5SlotRef.current === slotIdx;

      const handleTimeUpdate = () => {
        if (!isActiveSlot()) return;
        const cur = audio.currentTime || 0;
        const dur = audio.duration;
        setCurrentTime(cur);

        const cf = crossfadeDurationRef.current;
        if (
          cf > 0 &&
          !audio.paused &&
          Number.isFinite(dur) &&
          dur >= cf * 2.2 &&
          dur - cur <= cf &&
          dur - cur > 0.25
        ) {
          triggerEndOfTrackCrossfade();
        }
      };

      const handleLoadedMetadata = () => {
        if (!isActiveSlot()) return;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      };

      const handlePlaying = () => {
        if (!isActiveSlot()) return;
        setIsPlaying(true);
        setIsBuffering(false);
      };

      const handlePause = () => {
        if (!isActiveSlot()) return;
        setIsPlaying(false);
      };

      const handleWaiting = () => {
        if (!isActiveSlot()) return;
        setIsBuffering(true);
      };

      const handleCanPlay = () => {
        if (!isActiveSlot()) return;
        setIsBuffering(false);
      };

      const handleEnded = () => {
        if (!isActiveSlot()) return;
        advanceQueueOnEndOrSkipRef.current();
      };

      const handleError = () => {
        if (!isActiveSlot()) return;
        const curId = currentTrackIdRef.current;
        const curTrack = curId ? trackRegistryRef.current[curId] : null;
        const fallbacks = curTrack?.fallbackAudioUrls || [];
        const nextIdx = fallbackAttemptIndexRef.current;
        if (fallbacks[nextIdx]) {
          fallbackAttemptIndexRef.current = nextIdx + 1;
          audio.src = fallbacks[nextIdx];
          audio.load();
          audio.play().catch(() => {
            setIsPlaying(false);
            setIsBuffering(false);
          });
          return;
        }
        setIsPlaying(false);
        setIsBuffering(false);
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('playing', handlePlaying);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('waiting', handleWaiting);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      cleanups.push(() => {
        clearHtml5Fade(slotIdx);
        audio.pause();
        audio.src = '';
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('waiting', handleWaiting);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        html5PoolRef.current[slotIdx] = null;
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [clearHtml5Fade, triggerEndOfTrackCrossfade]);

  // Sync live volume & mute across both decks and pools (scaling any ongoing cross-fade cleanly)
  useEffect(() => {
    ([0, 1] as const).forEach((idx) => {
      applyHtml5SlotGain(idx, html5FadeGainRef.current[idx]);
      applyYtDeckGain(idx, ytFadeGainRef.current[idx]);
    });
  }, [volume, isMuted, applyHtml5SlotGain, applyYtDeckGain]);

  const playTrack = useCallback(
    (
      track: Track,
      contextTracks?: Track[],
      _options?: { preserveOrder?: boolean }
    ) => {
      releaseTransitionLock();

      if (track.id === currentTrackIdRef.current && !contextTracks) {
        const deckIdx = activeYtDeckRef.current;
        const ytPlayer = ytPlayersRef.current[deckIdx];
        if (activeEngineRef.current === 'youtube' && ytReadyRef.current[deckIdx] && ytPlayer) {
          if (isPlayingRef.current) {
            ytPlayer.pauseVideo();
          } else {
            setIsBuffering(true);
            ytPlayer.playVideo();
          }
          return;
        }
        const slot = activeHtml5SlotRef.current;
        const audio = html5PoolRef.current[slot];
        if (activeEngineRef.current === 'html5' && audio?.src) {
          if (isPlayingRef.current) {
            audio.pause();
          } else {
            setIsBuffering(true);
            audio.play().catch(() => startPlaybackForTrack(track));
          }
          return;
        }
      }

      // Clicking a track already inside the visible Queue updates currentIndex in-place without scrambling
      if (!contextTracks && queueIdsRef.current.includes(track.id)) {
        registerTracks([track]);
        const idxInQueue = queueIdsRef.current.indexOf(track.id);
        currentIndexRef.current = idxInQueue;
        setCurrentIndex(idxInQueue);
        currentTrackIdRef.current = track.id;
        startPlaybackForTrack(track, false, 'skip');
        return;
      }

      ++moodMixSeqRef.current;

      if (contextTracks && contextTracks.length > 0) {
        // Explicit sequential queue (index 0, 1, 2, ...) matching Search Results / Playlist / Shelf order
        registerTracks(contextTracks);
        const baseIds = Array.from(new Set(contextTracks.map((t) => t.id)));
        if (!baseIds.includes(track.id)) baseIds.unshift(track.id);
        const clickedIdx = baseIds.indexOf(track.id);

        isShuffledRef.current = false;
        setIsShuffled(false);
        originalQueueIdsRef.current = baseIds;
        queueIdsRef.current = baseIds;
        setOriginalQueueIds(baseIds);
        setQueueIds(baseIds);
        currentIndexRef.current = clickedIdx;
        setCurrentIndex(clickedIdx);
      } else {
        const globalPool = [
          track,
          ...indonesiaTrending,
          ...featuredTracks,
          ...viralTracks,
          ...indieRnbTracks,
        ];
        registerTracks(globalPool);
        const baseIds = Array.from(new Set(globalPool.map((t) => t.id)));
        const clickedIdx = baseIds.indexOf(track.id);

        isShuffledRef.current = false;
        setIsShuffled(false);
        originalQueueIdsRef.current = baseIds;
        queueIdsRef.current = baseIds;
        setOriginalQueueIds(baseIds);
        setQueueIds(baseIds);
        currentIndexRef.current = clickedIdx;
        setCurrentIndex(clickedIdx);
      }

      currentTrackIdRef.current = track.id;
      startPlaybackForTrack(track, false, 'skip');
    },
    [
      featuredTracks,
      indieRnbTracks,
      indonesiaTrending,
      registerTracks,
      releaseTransitionLock,
      startPlaybackForTrack,
      viralTracks,
    ]
  );

  const playTrackAtTime = useCallback(
    (track: Track, startSeconds = 0) => {
      releaseTransitionLock();
      const pool = [
        track,
        ...indonesiaTrending,
        ...featuredTracks,
        ...viralTracks,
        ...indieRnbTracks,
      ];
      registerTracks(pool);

      const baseIds = Array.from(new Set(pool.map((t) => t.id)));
      const idx = baseIds.indexOf(track.id);
      isShuffledRef.current = false;
      setIsShuffled(false);
      originalQueueIdsRef.current = baseIds;
      queueIdsRef.current = baseIds;
      setOriginalQueueIds(baseIds);
      setQueueIds(baseIds);
      currentIndexRef.current = idx;
      setCurrentIndex(idx);

      if (track.id === currentTrackIdRef.current) {
        const deckIdx = activeYtDeckRef.current;
        const ytPlayer = ytPlayersRef.current[deckIdx];
        if (activeEngineRef.current === 'youtube' && ytReadyRef.current[deckIdx] && ytPlayer) {
          lastManualSeekAtRef.current = Date.now();
          setCurrentTime(startSeconds);
          ytPlayer.seekTo(startSeconds, true);
          ytPlayer.playVideo();
          return;
        }
        const audio = html5PoolRef.current[activeHtml5SlotRef.current];
        if (activeEngineRef.current === 'html5' && audio?.src) {
          audio.currentTime = startSeconds;
          setCurrentTime(startSeconds);
          audio.play().catch(() => startPlaybackForTrack(track, false, 'skip', startSeconds));
          return;
        }
      }

      currentTrackIdRef.current = track.id;
      startPlaybackForTrack(track, false, 'skip', startSeconds);
    },
    [
      featuredTracks,
      indieRnbTracks,
      indonesiaTrending,
      registerTracks,
      releaseTransitionLock,
      startPlaybackForTrack,
      viralTracks,
    ]
  );

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) {
      const firstId = queueIds[0];
      const first =
        (firstId ? trackRegistry[firstId] : null) ||
        indonesiaTrending[0] ||
        featuredTracks[0] ||
        localTracks[0];
      if (first) {
        playTrack(
          first,
          indonesiaTrending.length
            ? indonesiaTrending
            : featuredTracks.length
              ? featuredTracks
              : localTracks
        );
      }
      return;
    }

    const deckIdx = activeYtDeckRef.current;
    const ytPlayer = ytPlayersRef.current[deckIdx];
    if (activeEngineRef.current === 'youtube' && ytReadyRef.current[deckIdx] && ytPlayer) {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        setIsBuffering(true);
        ytPlayer.playVideo();
      }
      return;
    }

    const audio = html5PoolRef.current[activeHtml5SlotRef.current];
    if (activeEngineRef.current === 'html5' && audio) {
      if (isPlaying) {
        audio.pause();
      } else if (audio.src) {
        setIsBuffering(true);
        audio.play().catch(() => startPlaybackForTrack(currentTrack));
      } else {
        startPlaybackForTrack(currentTrack);
      }
      return;
    }

    startPlaybackForTrack(currentTrack);
  }, [
    currentTrack,
    featuredTracks,
    indonesiaTrending,
    isPlaying,
    localTracks,
    playTrack,
    queueIds,
    startPlaybackForTrack,
    trackRegistry,
  ]);

  const playNext = useCallback(() => {
    const queue = queueIdsRef.current;
    if (queue.length === 0) return;

    // 1.5s debounce / lock prevents double triggers from UI + onEnded / YT.PlayerState.ENDED
    if (!acquireTransitionLock(1500)) return;

    const curIdx = getResolvedCurrentIndex(queue, currentTrackIdRef.current);
    const nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % queue.length;
    const nextTrack = trackRegistryRef.current[queue[nextIdx]];
    if (nextTrack) {
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      currentTrackIdRef.current = nextTrack.id;
      startPlaybackForTrack(nextTrack, false, 'skip');
    }
  }, [acquireTransitionLock, getResolvedCurrentIndex, startPlaybackForTrack]);

  const seekTo = useCallback(
    (seconds: number) => {
      const deckIdx = activeYtDeckRef.current;
      const ytPlayer = ytPlayersRef.current[deckIdx];
      if (activeEngineRef.current === 'youtube' && ytReadyRef.current[deckIdx] && ytPlayer) {
        const ytDur = ytPlayer.getDuration?.() || duration || 0;
        const maxVal = ytDur > 0 ? ytDur : seconds;
        const clamped = Math.max(0, Math.min(seconds, maxVal));
        lastManualSeekAtRef.current = Date.now();
        setCurrentTime(clamped);
        ytPlayer.seekTo(clamped, true);
        return;
      }

      const audio = html5PoolRef.current[activeHtml5SlotRef.current];
      if (!audio) return;
      const clamped = Math.max(0, Math.min(seconds, audio.duration || duration || 0));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [duration]
  );

  const playPrev = useCallback(() => {
    const deckIdx = activeYtDeckRef.current;
    const ytPlayer = ytPlayersRef.current[deckIdx];
    const audio = html5PoolRef.current[activeHtml5SlotRef.current];
    const elapsed =
      activeEngineRef.current === 'youtube' && ytReadyRef.current[deckIdx] && ytPlayer
        ? ytPlayer.getCurrentTime?.() ?? currentTimeRef.current
        : audio?.currentTime ?? currentTimeRef.current;

    if (elapsed > 3) {
      seekTo(0);
      return;
    }

    const queue = queueIdsRef.current;
    if (queue.length === 0) return;
    if (!acquireTransitionLock(1500)) return;

    const curIdx = getResolvedCurrentIndex(queue, currentTrackIdRef.current);
    const prevIdx = curIdx <= 0 ? queue.length - 1 : curIdx - 1;
    const prevTrack = trackRegistryRef.current[queue[prevIdx]];
    if (prevTrack) {
      currentIndexRef.current = prevIdx;
      setCurrentIndex(prevIdx);
      currentTrackIdRef.current = prevTrack.id;
      startPlaybackForTrack(prevTrack, false, 'skip');
    }
  }, [acquireTransitionLock, getResolvedCurrentIndex, seekTo, startPlaybackForTrack]);

  const togglePlayPauseRef = useRef(togglePlayPause);
  togglePlayPauseRef.current = togglePlayPause;
  const playPrevRef = useRef(playPrev);
  playPrevRef.current = playPrev;
  const playNextRef = useRef(playNext);
  playNextRef.current = playNext;
  const seekToRef = useRef(seekTo);
  seekToRef.current = seekTo;

  const setVolume = useCallback(
    (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      setVolumeState(clamped);
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
      }
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleShuffle = useCallback(() => {
    const next = !isShuffledRef.current;
    isShuffledRef.current = next;
    setIsShuffled(next);

    const base =
      originalQueueIdsRef.current.length > 0 ? originalQueueIdsRef.current : queueIdsRef.current;
    const cur = currentTrackIdRef.current;
    if (next) {
      const anchorTrack = cur ? trackRegistryRef.current[cur] || null : null;
      const otherTracks = (cur ? base.filter((id) => id !== cur) : base)
        .map((id) => trackRegistryRef.current[id])
        .filter((t): t is Track => Boolean(t));
      const smartOrderedIds = smartShuffleTracks(
        otherTracks,
        listeningHistoryRef.current,
        anchorTrack
      ).map((t) => t.id);
      const shuffled = cur ? [cur, ...smartOrderedIds] : smartOrderedIds;
      queueIdsRef.current = shuffled;
      setQueueIds(shuffled);
      const nextIdx = cur ? shuffled.indexOf(cur) : -1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      pushToast('Smart Shuffle aktif (hindari artis sama & sesuai riwayat)', 'success');
    } else {
      const restored = [...base];
      queueIdsRef.current = restored;
      setQueueIds(restored);
      const nextIdx = cur ? restored.indexOf(cur) : -1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      pushToast('Urutan antrean normal', 'info');
    }
  }, [pushToast]);

  const cycleLoopMode = useCallback(() => {
    setLoopMode((prev) => {
      const next: LoopMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      const label =
        next === 'all' ? 'Ulangi semua antrean' : next === 'one' ? 'Ulangi satu lagu' : 'Loop dimatikan';
      pushToast(label, 'info');
      return next;
    });
  }, [pushToast]);

  const pauseActivePlayback = useCallback(() => {
    ([0, 1] as const).forEach((idx) => {
      clearYtFade(idx);
      clearHtml5Fade(idx);
      if (ytReadyRef.current[idx] && ytPlayersRef.current[idx]) {
        try {
          ytPlayersRef.current[idx]!.pauseVideo();
        } catch {
          // Ignore if YT player unavailable
        }
      }
      const audio = html5PoolRef.current[idx];
      if (audio) {
        try {
          audio.pause();
        } catch {
          // Ignore
        }
      }
    });
    setIsPlaying(false);
    setIsBuffering(false);
  }, [clearHtml5Fade, clearYtFade]);

  const clearSleepTimeout = useCallback(() => {
    if (sleepTimeoutRef.current !== null) {
      window.clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
  }, []);

  const triggerSleepStop = useCallback(() => {
    clearSleepTimeout();
    sleepTimerEndAtRef.current = null;
    sleepTimerModeRef.current = 'off';
    setSleepTimerMode('off');
    setSleepTimerRemaining(null);
    pauseActivePlayback();
    pushToast('Sleep timer selesai — pemutaran dijeda', 'info');
  }, [clearSleepTimeout, pauseActivePlayback, pushToast]);

  const setSleepTimerMinutes = useCallback(
    (minutes: number) => {
      const safeMinutes = Math.max(1, Math.min(240, Math.round(minutes)));
      const totalSeconds = safeMinutes * 60;
      clearSleepTimeout();
      sleepTimerEndAtRef.current = Date.now() + totalSeconds * 1000;
      sleepTimerModeRef.current = 'countdown';
      setSleepTimerMode('countdown');
      setSleepTimerRemaining(totalSeconds);
      sleepTimeoutRef.current = window.setTimeout(() => {
        triggerSleepStop();
      }, totalSeconds * 1000);
      pushToast(`Sleep timer diatur: ${safeMinutes} menit`, 'success');
    },
    [clearSleepTimeout, pushToast, triggerSleepStop]
  );

  const setSleepTimerEndOfTrack = useCallback(() => {
    clearSleepTimeout();
    sleepTimerEndAtRef.current = null;
    sleepTimerModeRef.current = 'end_of_track';
    setSleepTimerMode('end_of_track');
    setSleepTimerRemaining(null);
    pushToast('Pemutaran akan dijeda saat lagu ini selesai', 'success');
  }, [clearSleepTimeout, pushToast]);

  const cancelSleepTimer = useCallback(() => {
    clearSleepTimeout();
    sleepTimerEndAtRef.current = null;
    sleepTimerModeRef.current = 'off';
    setSleepTimerMode('off');
    setSleepTimerRemaining(null);
    pushToast('Sleep timer dibatalkan', 'info');
  }, [clearSleepTimeout, pushToast]);

  useEffect(() => {
    return () => {
      clearSleepTimeout();
    };
  }, [clearSleepTimeout]);

  useEffect(() => {
    if (sleepTimerMode !== 'countdown') return;

    const tick = () => {
      const endAt = sleepTimerEndAtRef.current;
      if (!endAt) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);

      if (remaining <= 0) {
        triggerSleepStop();
      }
    };

    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [sleepTimerMode, triggerSleepStop]);

  const addToQueue = useCallback(
    (track: Track, playNextPosition = false) => {
      registerTracks([track]);
      const nextOrig = originalQueueIdsRef.current.includes(track.id)
        ? originalQueueIdsRef.current
        : [...originalQueueIdsRef.current, track.id];
      originalQueueIdsRef.current = nextOrig;
      setOriginalQueueIds(nextOrig);

      const filtered = queueIdsRef.current.filter((id) => id !== track.id);
      const curId = currentTrackIdRef.current;
      let nextQueue: string[];
      if (playNextPosition && curId) {
        const curIdx = filtered.indexOf(curId);
        if (curIdx !== -1) {
          const copy = [...filtered];
          copy.splice(curIdx + 1, 0, track.id);
          nextQueue = copy;
        } else {
          nextQueue = [...filtered, track.id];
        }
      } else {
        nextQueue = [...filtered, track.id];
      }
      queueIdsRef.current = nextQueue;
      setQueueIds(nextQueue);
      if (curId) {
        const idx = nextQueue.indexOf(curId);
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
      }
      pushToast(`"${track.title}" ditambahkan ke antrean`, 'success');
    },
    [pushToast, registerTracks]
  );

  const removeFromQueue = useCallback(
    (index: number) => {
      const currentList = queueIdsRef.current;
      if (index < 0 || index >= currentList.length) return;
      const targetId = currentList[index];
      const nextList = [...currentList];
      nextList.splice(index, 1);

      queueIdsRef.current = nextList;
      setQueueIds(nextList);

      if (targetId === currentTrackIdRef.current) {
        if (nextList.length > 0) {
          const nextIdx = Math.min(index, nextList.length - 1);
          const replacement = trackRegistryRef.current[nextList[nextIdx]];
          if (replacement) {
            currentIndexRef.current = nextIdx;
            setCurrentIndex(nextIdx);
            currentTrackIdRef.current = replacement.id;
            startPlaybackRef.current(replacement, false, 'skip');
            return;
          }
        }
        pauseActivePlayback();
        currentIndexRef.current = -1;
        setCurrentIndex(-1);
        currentTrackIdRef.current = null;
        setCurrentTrackId(null);
      } else if (currentTrackIdRef.current) {
        const newIdx = nextList.indexOf(currentTrackIdRef.current);
        currentIndexRef.current = newIdx;
        setCurrentIndex(newIdx);
      }
    },
    [pauseActivePlayback]
  );

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    const prev = queueIdsRef.current;
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= prev.length ||
      toIndex >= prev.length
    ) {
      return;
    }
    const copy = [...prev];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    queueIdsRef.current = copy;
    setQueueIds(copy);
    if (currentTrackIdRef.current) {
      const newIdx = copy.indexOf(currentTrackIdRef.current);
      currentIndexRef.current = newIdx;
      setCurrentIndex(newIdx);
    }
  }, []);

  const clearUpcomingQueue = useCallback(() => {
    const curId = currentTrackIdRef.current;
    const nextQueue =
      isPlayingRef.current && curId && queueIdsRef.current.includes(curId) ? [curId] : [];
    queueIdsRef.current = nextQueue;
    setQueueIds(nextQueue);
    const nextIdx = nextQueue.length > 0 ? 0 : -1;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    pushToast('Antrean dibersihkan', 'info');
  }, [pushToast]);

  const openPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setActiveView('playlist');
  }, []);

  const toggleRightPanelTab = useCallback((tab: Exclude<RightPanelTab, null>) => {
    setRightPanelTab((prev) => (prev === tab ? null : tab));
  }, []);

  const createPlaylist = useCallback(
    (name: string, description = ''): Playlist => {
      const playlist: Playlist = {
        id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || 'Playlist Baru',
        description: description.trim(),
        trackIds: [],
        createdAt: Date.now(),
      };
      setPlaylists((prev) => [playlist, ...prev]);
      pushToast(`Playlist "${playlist.name}" dibuat`, 'success');
      return playlist;
    },
    [pushToast]
  );

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(null);
        setActiveView('home');
      }
      pushToast('Playlist dihapus', 'info');
    },
    [pushToast, selectedPlaylistId]
  );

  const addTrackToPlaylist = useCallback(
    (playlistId: string, track: Track) => {
      registerTracks([track]);
      let playlistName = '';
      let alreadyExists = false;

      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          playlistName = pl.name;
          if (pl.trackIds.includes(track.id)) {
            alreadyExists = true;
            return pl;
          }
          return { ...pl, trackIds: [...pl.trackIds, track.id] };
        })
      );

      if (alreadyExists) {
        pushToast(`"${track.title}" sudah ada di ${playlistName}`, 'info');
      } else if (playlistName) {
        pushToast(`Ditambahkan ke ${playlistName}`, 'success');
      }
    },
    [pushToast, registerTracks]
  );

  const removeTrackFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }
            : pl
        )
      );
      pushToast('Lagu dihapus dari playlist', 'info');
    },
    [pushToast]
  );

  const toggleLike = useCallback(
    (track: Track) => {
      registerTracks([track]);
      setLikedIds((prev) => {
        const exists = prev.includes(track.id);
        if (exists) {
          pushToast('Dihapus dari Liked Songs', 'info');
          return prev.filter((id) => id !== track.id);
        }
        pushToast(`"${track.title}" disimpan ke Liked Songs`, 'success');
        return [track.id, ...prev];
      });
    },
    [pushToast, registerTracks]
  );

  const isLiked = useCallback((trackId: string) => likedIds.includes(trackId), [likedIds]);

  const uploadLocalFiles = useCallback(
    async (files: FileList | File[], targetPlaylistId?: string) => {
      const fileArray = Array.from(files).filter(
        (f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
      );
      if (fileArray.length === 0) {
        pushToast('Pilih file audio MP3, WAV, OGG, atau M4A yang valid.', 'info');
        return;
      }

      const addedTracks: Track[] = [];
      for (const file of fileArray) {
        const durationSec = await extractLocalFileDuration(file);
        const { title, artist } = parseFileNameMeta(file.name);
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const objectUrl = URL.createObjectURL(file);
        const newTrack: Track = {
          id,
          title,
          artist,
          album: 'Lagu Lokal',
          duration: durationSec,
          coverUrl: DEFAULT_COVER_URL,
          audioUrl: objectUrl,
          sourceType: 'local',
          lyrics: [],
          lyricsStatus: 'idle',
          createdAt: Date.now(),
        };

        await saveLocalTrackToDb(newTrack, file);
        addedTracks.push(newTrack);
      }

      registerTracks(addedTracks);
      setLocalTracks((prev) => [...addedTracks, ...prev]);

      if (targetPlaylistId) {
        setPlaylists((prev) =>
          prev.map((pl) =>
            pl.id === targetPlaylistId
              ? { ...pl, trackIds: [...pl.trackIds, ...addedTracks.map((t) => t.id)] }
              : pl
          )
        );
      }

      pushToast(`${addedTracks.length} lagu lokal disimpan permanen`, 'success');

      if (!currentTrackId && addedTracks[0]) {
        playTrack(addedTracks[0], addedTracks);
      }
    },
    [currentTrackId, playTrack, pushToast, registerTracks]
  );

  const deleteLocalTrack = useCallback(
    async (trackId: string) => {
      const target = trackRegistry[trackId];
      if (target?.audioUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.audioUrl);
      }
      await deleteLocalTrackFromDb(trackId);
      setLocalTracks((prev) => prev.filter((t) => t.id !== trackId));
      setLikedIds((prev) => prev.filter((id) => id !== trackId));
      setQueueIds((prev) => prev.filter((id) => id !== trackId));
      setPlaylists((prev) =>
        prev.map((pl) => ({ ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }))
      );
      pushToast('Lagu lokal dihapus', 'info');
    },
    [pushToast, trackRegistry]
  );

  const likedTracks = useMemo(
    () => likedIds.map((id) => trackRegistry[id]).filter((t): t is Track => Boolean(t)),
    [likedIds, trackRegistry]
  );

  const queueTracks = useMemo(
    () => queueIds.map((id) => trackRegistry[id]).filter((t): t is Track => Boolean(t)),
    [queueIds, trackRegistry]
  );

  const value: PlayerContextValue = {
    activeView,
    setActiveView,
    searchQuery,
    setSearchQuery,
    selectedPlaylistId,
    openPlaylist,
    rightPanelTab,
    setRightPanelTab,
    toggleRightPanelTab,
    isZenMode,
    setIsZenMode,
    isCreatePlaylistOpen,
    setIsCreatePlaylistOpen,
    localTracks,
    trackRegistry,
    registerTracks,
    playlists,
    likedIds,
    likedTracks,
    createPlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    toggleLike,
    isLiked,
    uploadLocalFiles,
    deleteLocalTrack,
    featuredTracks,
    indonesiaTrending,
    viralTracks,
    indieRnbTracks,
    isTrendingLoading,
    refreshTrending,
    currentTrack,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    loopMode,
    queueIds,
    queueTracks,
    currentIndex,
    currentMood,
    ambientColor: ambientPalette.primary,
    ambientPalette,
    playTrack,
    playTrackAtTime,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleLoopMode,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    clearUpcomingQueue,
    sleepTimerRemaining,
    sleepTimerMode,
    setSleepTimerMinutes,
    setSleepTimerEndOfTrack,
    cancelSleepTimer,
    activeEngine,
    ambientVideoId,
    isAmbientVideoEnabled,
    setIsAmbientVideoEnabled,
    toggleAmbientVideo,
    crossfadeDuration,
    setCrossfadeDuration,
    cycleCrossfadeDuration,
    isAutoplayEnabled,
    toggleAutoplay,
    lyricOffset,
    setLyricOffset,
    isInstallable,
    promptInstallApp,
    isWhisperComposerOpen,
    setIsWhisperComposerOpen,
    isLyricCardOpen,
    setIsLyricCardOpen,
    isWeeklyAuraOpen,
    setIsWeeklyAuraOpen,
    isTwinModalOpen,
    setIsTwinModalOpen,
    listeningHistory,
    simulateWeeklyAuraData,
    themeMode,
    resolvedTheme,
    cycleThemeMode,
    isDynamicThemeSync,
    toggleDynamicThemeSync,
    toasts,
    pushToast,
  };

  const showHomeAmbientVideo =
    !isZenMode &&
    isAmbientVideoEnabled &&
    Boolean(ambientVideoId) &&
    currentTrack?.sourceType !== 'local';

  return (
    <PlayerContext.Provider value={value}>
      {/* Hidden Dual-Deck YouTube IFrame Audio Engine (Official Audio synced with LRCLIB) */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-1 h-1 opacity-0 pointer-events-none overflow-hidden"
      >
        {([0, 1] as const).map((deckIdx) => (
          <div
            key={deckIdx}
            ref={(el) => {
              ytDeckWrapperRefs.current[deckIdx] = el;
            }}
            className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
          />
        ))}
      </div>

      {/* Layer 0: Subtle Soft Ambient Music Video + Frosted Glass Overlay behind Home / Explore / Library */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#F2F4F8] dark:bg-[#0B0B0D] transition-colors duration-300"
      >
        {showHomeAmbientVideo && ambientVideoId && (
          <iframe
            key={`home-mv-${ambientVideoId}`}
            title="Nocty Subtle Ambient Music Video"
            src={`https://www.youtube.com/embed/${ambientVideoId}?autoplay=1&mute=1&loop=1&playlist=${ambientVideoId}&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            tabIndex={-1}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[177.78vh] h-[56.25vw] scale-125 opacity-20 blur-xl pointer-events-none border-0"
          />
        )}
        <div
          className={`absolute inset-0 transition-all duration-700 ${
            showHomeAmbientVideo
              ? resolvedTheme === 'light'
                ? 'bg-[#F2F4F8]/78 backdrop-blur-md'
                : 'bg-[#0B0B0D]/75 backdrop-blur-md'
              : 'blur-3xl'
          }`}
          style={
            !showHomeAmbientVideo
              ? {
                  opacity:
                    resolvedTheme === 'light'
                      ? Math.min(0.5, ambientPalette.gradientIntensity * 0.9)
                      : Math.min(0.62, ambientPalette.gradientIntensity),
                  background: `
                    radial-gradient(circle at 20% 15%, rgba(${ambientPalette.primary.r}, ${ambientPalette.primary.g}, ${ambientPalette.primary.b}, 0.65) 0%, transparent 58%),
                    radial-gradient(circle at 82% 78%, rgba(${ambientPalette.secondary.r}, ${ambientPalette.secondary.g}, ${ambientPalette.secondary.b}, 0.55) 0%, transparent 58%)
                  `,
                }
              : undefined
          }
        />
      </div>
      {children}
    </PlayerContext.Provider>
  );
};

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer harus digunakan di dalam PlayerProvider');
  }
  return ctx;
}
