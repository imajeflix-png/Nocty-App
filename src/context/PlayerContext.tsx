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
  LoopMode,
  NavView,
  Playlist,
  RightPanelTab,
  Track,
} from '../types/music';
import { DEFAULT_COVER_URL, EMERGENCY_FALLBACK_TRACKS } from '../data/moods';
import {
  deleteLocalTrackFromDb,
  extractLocalFileDuration,
  getAllLocalTracksFromDb,
  loadLikedIdsFromStorage,
  loadPlayerPrefs,
  loadPlaylistsFromStorage,
  loadSavedTracksFromStorage,
  parseFileNameMeta,
  saveLikedIdsToStorage,
  saveLocalTrackToDb,
  savePlayerPrefs,
  savePlaylistsToStorage,
  saveSavedTracksToStorage,
} from '../services/storageDb';
import { resolvePipedStreamUrl, searchOnlineTracks } from '../services/pipedApi';
import { fetchSyncedLyrics } from '../services/lrclibApi';
import { extractCoverAmbientColor, fisherYatesShuffle } from '../utils/audioUtils';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface PlayerContextValue {
  // Navigation & Panels
  activeView: NavView;
  setActiveView: (view: NavView) => void;
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

  // Home Trending Feeds
  indonesiaTrending: Track[];
  globalTrending: Track[];
  isTrendingLoading: boolean;
  trendingError: string | null;
  trendingSource: 'piped' | 'itunes-fallback' | 'emergency';
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
  ambientColor: AmbientColor;

  // Player Actions
  playTrack: (track: Track, contextTracks?: Track[]) => void;
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

  // Notifications
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: ToastMessage['tone']) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const STREAM_CACHE_TTL_MS = 20 * 60 * 1000;

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPrefs = useMemo(() => loadPlayerPrefs(), []);

  // Views & UI Panels
  const [activeView, setActiveView] = useState<NavView>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('lyrics');
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

  // Home Trending Feeds
  const [indonesiaTrending, setIndonesiaTrending] = useState<Track[]>([]);
  const [globalTrending, setGlobalTrending] = useState<Track[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [trendingSource, setTrendingSource] = useState<'piped' | 'itunes-fallback' | 'emergency'>('piped');

  // Audio & Queue State
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialPrefs.volume);
  const [isMuted, setIsMuted] = useState(initialPrefs.isMuted);
  const [isShuffled, setIsShuffled] = useState(initialPrefs.isShuffled);
  const [loopMode, setLoopMode] = useState<LoopMode>(initialPrefs.loopMode);
  const [originalQueueIds, setOriginalQueueIds] = useState<string[]>([]);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [ambientColor, setAmbientColor] = useState<AmbientColor>({
    r: 16,
    g: 185,
    b: 129,
    hex: '#10B981',
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs for stable async callbacks & HTML5 <audio>
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamCacheRef = useRef<Map<string, { url: string; cachedAt: number }>>(new Map());
  const playRequestSeqRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const lyricsAbortRef = useRef<AbortController | null>(null);
  const trackRegistryRef = useRef(trackRegistry);
  trackRegistryRef.current = trackRegistry;

  const queueIdsRef = useRef(queueIds);
  queueIdsRef.current = queueIds;
  const currentTrackIdRef = useRef(currentTrackId);
  currentTrackIdRef.current = currentTrackId;
  const loopModeRef = useRef(loopMode);
  loopModeRef.current = loopMode;

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
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
          (existing.lyrics.length === 0 && t.lyrics.length > 0)
        ) {
          next[t.id] = {
            ...existing,
            ...t,
            lyrics: t.lyrics.length > 0 ? t.lyrics : existing.lyrics,
            lyricsStatus:
              t.lyrics.length > 0 ? 'loaded' : existing.lyricsStatus || t.lyricsStatus,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // Persist playlists, likes, saved tracks, and prefs
  useEffect(() => {
    savePlaylistsToStorage(playlists);
  }, [playlists]);

  useEffect(() => {
    saveLikedIdsToStorage(likedIds);
  }, [likedIds]);

  useEffect(() => {
    savePlayerPrefs({ volume, isMuted, isShuffled, loopMode });
  }, [volume, isMuted, isShuffled, loopMode]);

  // Snapshot any online tracks referenced by playlists or likedIds so they survive reload
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

  // Load local tracks from IndexedDB on startup
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

  // Fetch initial Trending feeds from Piped API on mount
  const refreshTrending = useCallback(async () => {
    setIsTrendingLoading(true);
    setTrendingError(null);
    const controller = new AbortController();

    try {
      const [idRes, globalRes] = await Promise.allSettled([
        searchOnlineTracks('Top Hits Indonesia 2026', controller.signal),
        searchOnlineTracks('Global Top Songs', controller.signal),
      ]);

      let idTracks: Track[] = [];
      let glTracks: Track[] = [];
      let sourceUsed: 'piped' | 'itunes-fallback' | 'emergency' = 'piped';

      if (idRes.status === 'fulfilled') {
        idTracks = idRes.value.tracks.slice(0, 14);
        if (idRes.value.source === 'itunes-fallback') sourceUsed = 'itunes-fallback';
      }
      if (globalRes.status === 'fulfilled') {
        glTracks = globalRes.value.tracks.slice(0, 14);
        if (globalRes.value.source === 'itunes-fallback' && sourceUsed !== 'piped') {
          sourceUsed = 'itunes-fallback';
        }
      }

      if (idTracks.length === 0 && glTracks.length === 0) {
        idTracks = EMERGENCY_FALLBACK_TRACKS;
        glTracks = [...EMERGENCY_FALLBACK_TRACKS].reverse();
        sourceUsed = 'emergency';
        setTrendingError('Server streaming sedang sibuk. Menampilkan koleksi studio sementara.');
      }

      const combined = [...idTracks, ...glTracks];
      registerTracks(combined);
      setIndonesiaTrending(idTracks);
      setGlobalTrending(glTracks);
      setTrendingSource(sourceUsed);

      // Prime initial queue without autoplaying
      setOriginalQueueIds((prev) => (prev.length === 0 ? combined.map((t) => t.id) : prev));
      setQueueIds((prev) => (prev.length === 0 ? combined.map((t) => t.id) : prev));
    } catch {
      registerTracks(EMERGENCY_FALLBACK_TRACKS);
      setIndonesiaTrending(EMERGENCY_FALLBACK_TRACKS);
      setGlobalTrending([...EMERGENCY_FALLBACK_TRACKS].reverse());
      setTrendingSource('emergency');
      setTrendingError('Tidak dapat terhubung ke Piped API. Menggunakan mode studio offline.');
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

  // Extract ambient color whenever active track cover changes
  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    extractCoverAmbientColor(currentTrack.coverUrl, currentTrack.id).then((color) => {
      if (cancelled) return;
      setAmbientColor(color);
      document.documentElement.style.setProperty('--ambient-rgb', `${color.r}, ${color.g}, ${color.b}`);
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.coverUrl]);

  // Automatically fetch LRCLIB synced lyrics when a track becomes active
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

    fetchSyncedLyrics(currentTrack.artist, currentTrack.title, controller.signal)
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

  // Core audio loader & player
  const startPlaybackForTrack = useCallback(
    async (track: Track, forceRefreshStream = false) => {
      const audio = audioRef.current;
      if (!audio) return;

      const reqSeq = ++playRequestSeqRef.current;
      streamAbortRef.current?.abort();

      setCurrentTrackId(track.id);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      setIsBuffering(true);

      // Direct playback for local IndexedDB ObjectURLs, preview URLs, or emergency fallback tracks
      if (track.sourceType !== 'online' || (!track.videoId && track.audioUrl)) {
        if (!track.audioUrl) {
          setIsBuffering(false);
          setIsPlaying(false);
          pushToast('Sumber audio trek ini tidak tersedia.', 'error');
          return;
        }
        try {
          audio.src = track.audioUrl;
          audio.load();
          await audio.play();
          if (playRequestSeqRef.current === reqSeq) {
            setIsPlaying(true);
            setIsBuffering(false);
          }
        } catch {
          if (playRequestSeqRef.current === reqSeq) {
            setIsPlaying(false);
            setIsBuffering(false);
          }
        }
        return;
      }

      // Full-track Piped stream resolution via /streams/:videoId
      const videoId = track.videoId!;
      const cached = !forceRefreshStream ? streamCacheRef.current.get(videoId) : undefined;
      if (cached && Date.now() - cached.cachedAt < STREAM_CACHE_TTL_MS) {
        try {
          audio.src = cached.url;
          audio.load();
          await audio.play();
          if (playRequestSeqRef.current === reqSeq) {
            setIsPlaying(true);
            setIsBuffering(false);
          }
          return;
        } catch {
          streamCacheRef.current.delete(videoId);
        }
      }

      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        const streamUrl = await resolvePipedStreamUrl(videoId, controller.signal);
        if (playRequestSeqRef.current !== reqSeq || controller.signal.aborted) return;

        streamCacheRef.current.set(videoId, { url: streamUrl, cachedAt: Date.now() });
        audio.src = streamUrl;
        audio.load();
        await audio.play();

        if (playRequestSeqRef.current === reqSeq) {
          setIsPlaying(true);
          setIsBuffering(false);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError' || playRequestSeqRef.current !== reqSeq) return;
        setIsPlaying(false);
        setIsBuffering(false);
        pushToast(`Gagal memutar "${track.title}". Mencoba server lain...`, 'error');
      }
    },
    [pushToast]
  );

  // Initialize single HTML5 <audio> element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = isMuted ? 0 : volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleEnded = () => {
      const mode = loopModeRef.current;
      if (mode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      const q = queueIdsRef.current;
      const curId = currentTrackIdRef.current;
      const idx = curId ? q.indexOf(curId) : -1;

      if (idx !== -1 && idx + 1 < q.length) {
        const nextTrack = trackRegistryRef.current[q[idx + 1]];
        if (nextTrack) {
          startPlaybackForTrack(nextTrack);
          return;
        }
      }

      if (mode === 'all' && q.length > 0) {
        const firstTrack = trackRegistryRef.current[q[0]];
        if (firstTrack) {
          startPlaybackForTrack(firstTrack);
          return;
        }
      }

      setIsPlaying(false);
    };

    const handleError = () => {
      const curId = currentTrackIdRef.current;
      const curTrack = curId ? trackRegistryRef.current[curId] : null;
      if (curTrack?.sourceType === 'online' && curTrack.videoId && streamCacheRef.current.has(curTrack.videoId)) {
        streamCacheRef.current.delete(curTrack.videoId);
        startPlaybackForTrack(curTrack, true);
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

    return () => {
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
    };
  }, [startPlaybackForTrack]);

  // Sync audio volume & mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const playTrack = useCallback(
    (track: Track, contextTracks?: Track[]) => {
      registerTracks(contextTracks ? [track, ...contextTracks] : [track]);

      if (track.id === currentTrackId && audioRef.current?.src && !contextTracks) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play().catch(() => {});
        }
        return;
      }

      if (contextTracks && contextTracks.length > 0) {
        const baseIds = Array.from(new Set(contextTracks.map((t) => t.id)));
        if (!baseIds.includes(track.id)) baseIds.unshift(track.id);
        setOriginalQueueIds(baseIds);

        if (isShuffled) {
          const others = baseIds.filter((id) => id !== track.id);
          setQueueIds([track.id, ...fisherYatesShuffle(others)]);
        } else {
          setQueueIds(baseIds);
        }
      } else if (!queueIds.includes(track.id)) {
        setOriginalQueueIds((prev) => [track.id, ...prev]);
        setQueueIds((prev) => [track.id, ...prev]);
      }

      startPlaybackForTrack(track);
    },
    [currentTrackId, isPlaying, isShuffled, queueIds, registerTracks, startPlaybackForTrack]
  );

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack) {
      const firstId = queueIds[0];
      const first = firstId ? trackRegistry[firstId] : indonesiaTrending[0] || localTracks[0];
      if (first) {
        playTrack(first, indonesiaTrending.length ? indonesiaTrending : localTracks);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
    } else if (audio.src) {
      audio.play().catch(() => {
        startPlaybackForTrack(currentTrack, true);
      });
    } else {
      startPlaybackForTrack(currentTrack);
    }
  }, [currentTrack, indonesiaTrending, isPlaying, localTracks, playTrack, queueIds, startPlaybackForTrack, trackRegistry]);

  const playNext = useCallback(() => {
    if (queueIds.length === 0) return;
    const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;
    const nextIdx = idx + 1 < queueIds.length ? idx + 1 : 0;
    const nextTrack = trackRegistry[queueIds[nextIdx]];
    if (nextTrack) startPlaybackForTrack(nextTrack);
  }, [currentTrackId, queueIds, startPlaybackForTrack, trackRegistry]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (queueIds.length === 0) return;
    const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : 0;
    const prevIdx = idx - 1 >= 0 ? idx - 1 : queueIds.length - 1;
    const prevTrack = trackRegistry[queueIds[prevIdx]];
    if (prevTrack) startPlaybackForTrack(prevTrack);
  }, [currentTrackId, queueIds, startPlaybackForTrack, trackRegistry]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || duration || 0));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev) => {
      const next = !prev;
      const base = originalQueueIds.length > 0 ? originalQueueIds : queueIds;
      if (next) {
        const cur = currentTrackId;
        const others = cur ? base.filter((id) => id !== cur) : base;
        const shuffled = cur ? [cur, ...fisherYatesShuffle(others)] : fisherYatesShuffle(others);
        setQueueIds(shuffled);
        pushToast('True Shuffle (Fisher-Yates) aktif', 'success');
      } else {
        setQueueIds([...base]);
        pushToast('Urutan antrean dikembalikan normal', 'info');
      }
      return next;
    });
  }, [currentTrackId, originalQueueIds, pushToast, queueIds]);

  const cycleLoopMode = useCallback(() => {
    setLoopMode((prev) => {
      const next: LoopMode = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      const label =
        next === 'all' ? 'Ulangi semua antrean' : next === 'one' ? 'Ulangi satu lagu' : 'Loop dimatikan';
      pushToast(label, 'info');
      return next;
    });
  }, [pushToast]);

  const addToQueue = useCallback(
    (track: Track, playNextPosition = false) => {
      registerTracks([track]);
      setOriginalQueueIds((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
      setQueueIds((prev) => {
        const filtered = prev.filter((id) => id !== track.id);
        if (playNextPosition && currentTrackId) {
          const curIdx = filtered.indexOf(currentTrackId);
          if (curIdx !== -1) {
            const copy = [...filtered];
            copy.splice(curIdx + 1, 0, track.id);
            return copy;
          }
        }
        return [...filtered, track.id];
      });
      pushToast(`"${track.title}" ditambahkan ke antrean`, 'success');
    },
    [currentTrackId, pushToast, registerTracks]
  );

  const removeFromQueue = useCallback((index: number) => {
    setQueueIds((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const targetId = prev[index];
      if (targetId === currentTrackId) return prev;
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  }, [currentTrackId]);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueueIds((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const clearUpcomingQueue = useCallback(() => {
    setQueueIds((prev) => (currentTrackId && prev.includes(currentTrackId) ? [currentTrackId] : []));
    pushToast('Antrean berikutnya dibersihkan', 'info');
  }, [currentTrackId, pushToast]);

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
          pushToast(`Dihapus dari Liked Songs`, 'info');
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
        pushToast('Pilih file audio MP3, WAV, OGG, atau M4A yang valid.', 'error');
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

      pushToast(
        `${addedTracks.length} lagu lokal disimpan permanen di browser`,
        'success'
      );

      // Auto-start first uploaded track if nothing is playing
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
    indonesiaTrending,
    globalTrending,
    isTrendingLoading,
    trendingError,
    trendingSource,
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
    ambientColor,
    playTrack,
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
    toasts,
    pushToast,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer harus digunakan di dalam PlayerProvider');
  }
  return ctx;
}
