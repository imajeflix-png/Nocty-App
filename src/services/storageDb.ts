import { LoopMode, Playlist, Track } from '../types/music';
import { DEFAULT_COVER_URL } from '../data/moods';

const DB_NAME = 'nocty-audio-db';
const DB_VERSION = 1;
const STORE_NAME = 'local_tracks';

const STORAGE_KEYS = {
  PLAYLISTS: 'nocty_playlists_v1',
  LIKED_IDS: 'nocty_liked_ids_v1',
  SAVED_TRACKS: 'nocty_saved_tracks_v1',
  PREFS: 'nocty_player_prefs_v1',
  AMBIENT_VIDEO: 'nocty_ambient_video',
  AUTOPLAY: 'nocty_autoplay',
};

interface StoredLocalTrackRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  blob: Blob;
  createdAt: number;
}

export interface PlayerPrefs {
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  loopMode: LoopMode;
  crossfadeDuration: number;
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB.'));
  });
}

export async function saveLocalTrackToDb(track: Track, blob: Blob): Promise<void> {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredLocalTrackRecord = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || 'Lagu Lokal',
      duration: track.duration,
      coverUrl: track.coverUrl || DEFAULT_COVER_URL,
      blob,
      createdAt: track.createdAt,
    };
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Gagal menyimpan file audio ke IndexedDB.'));
    };
  });
}

export async function getAllLocalTracksFromDb(): Promise<Track[]> {
  try {
    const db = await openAudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as StoredLocalTrackRecord[];
        const tracks: Track[] = rows
          .map((row) => ({
            id: row.id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            duration: row.duration,
            coverUrl: row.coverUrl || DEFAULT_COVER_URL,
            audioUrl: URL.createObjectURL(row.blob),
            sourceType: 'local' as const,
            lyrics: [],
            lyricsStatus: 'idle' as const,
            createdAt: row.createdAt,
          }))
          .sort((a, b) => b.createdAt - a.createdAt);
        db.close();
        resolve(tracks);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return [];
  }
}

export async function deleteLocalTrackFromDb(trackId: string): Promise<void> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(trackId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore cleanup errors silently
  }
}

export function extractLocalFileDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    const finish = (dur: number) => {
      URL.revokeObjectURL(tempUrl);
      resolve(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 180);
    };

    const timeout = window.setTimeout(() => finish(180), 3000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      finish(audio.duration);
    };
    audio.onerror = () => {
      window.clearTimeout(timeout);
      finish(180);
    };
    audio.src = tempUrl;
  });
}

export function parseFileNameMeta(fileName: string): { title: string; artist: string } {
  const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
  const dashSplit = cleanName.split(/\s+-\s+/);
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Artis Lokal',
      title: dashSplit.slice(1).join(' - ').trim() || cleanName,
    };
  }
  return {
    title: cleanName || 'Trek Lokal Tanpa Judul',
    artist: 'Koleksi Lokal',
  };
}

export function loadPlaylistsFromStorage(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlaylistsToStorage(playlists: Playlist[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  } catch {
    // Ignore quota errors
  }
}

export function loadLikedIdsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIKED_IDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLikedIdsToStorage(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LIKED_IDS, JSON.stringify(ids));
  } catch {
    // Ignore quota errors
  }
}

export function loadSavedTracksFromStorage(): Record<string, Track> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_TRACKS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSavedTracksToStorage(tracksMap: Record<string, Track>): void {
  try {
    const sanitized: Record<string, Track> = {};
    for (const [id, track] of Object.entries(tracksMap)) {
      if (track.sourceType === 'local') continue;
      sanitized[id] = {
        ...track,
        lyricsStatus: track.lyrics.length > 0 ? 'loaded' : 'idle',
      };
    }
    localStorage.setItem(STORAGE_KEYS.SAVED_TRACKS, JSON.stringify(sanitized));
  } catch {
    // Ignore quota errors
  }
}

export function loadPlayerPrefs(): PlayerPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFS);
    if (!raw) {
      return {
        volume: 0.8,
        isMuted: false,
        isShuffled: false,
        loopMode: 'off',
        crossfadeDuration: 5,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.8,
      isMuted: Boolean(parsed.isMuted),
      isShuffled: Boolean(parsed.isShuffled),
      loopMode: parsed.loopMode === 'all' || parsed.loopMode === 'one' ? parsed.loopMode : 'off',
      crossfadeDuration:
        typeof parsed.crossfadeDuration === 'number'
          ? Math.max(0, Math.min(12, Math.round(parsed.crossfadeDuration)))
          : 5,
    };
  } catch {
    return {
      volume: 0.8,
      isMuted: false,
      isShuffled: false,
      loopMode: 'off',
      crossfadeDuration: 5,
    };
  }
}

export function savePlayerPrefs(prefs: PlayerPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(prefs));
  } catch {
    // Ignore
  }
}

export function loadAmbientVideoPref(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AMBIENT_VIDEO);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function saveAmbientVideoPref(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AMBIENT_VIDEO, String(enabled));
  } catch {
    // Ignore
  }
}

export function loadAutoplayPref(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTOPLAY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function saveAutoplayPref(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTOPLAY, String(enabled));
  } catch {
    // Ignore
  }
}

