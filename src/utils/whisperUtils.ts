import { Track } from '../types/music';

export type WhisperBadge = 'Couple / LDR' | 'Bestie' | 'Just Friend';

export const WHISPER_BADGES: WhisperBadge[] = [
  'Couple / LDR',
  'Bestie',
  'Just Friend',
];

export const WHISPER_BADGE_EMOJI: Record<WhisperBadge, string> = {
  'Couple / LDR': '2764-fe0f',
  Bestie: '2728',
  'Just Friend': '1f609',
};

export interface WhisperPayload {
  track: {
    id: string;
    title: string;
    artist: string;
    album: string;
    coverUrl: string;
    videoId?: string;
    audioUrl?: string;
    duration: number;
  };
  startTime: number;
  lines: string[];
  message: string;
  senderName: string;
  badge: WhisperBadge;
}

interface CompactWhisperWire {
  v: 1;
  id: string;
  t: string;
  a: string;
  al: string;
  c: string;
  vid?: string;
  au?: string;
  d: number;
  st: number;
  ls: string[];
  m: string;
  s: string;
  b: string;
}

function bytesToUrlSafeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function urlSafeBase64ToBytes(base64Url: string): Uint8Array {
  const padded = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeWhisperPayload(payload: WhisperPayload): string {
  const wire: CompactWhisperWire = {
    v: 1,
    id: payload.track.id,
    t: payload.track.title,
    a: payload.track.artist,
    al: payload.track.album || '',
    c: payload.track.coverUrl,
    vid: payload.track.videoId || undefined,
    au: payload.track.audioUrl || undefined,
    d: Math.round(payload.track.duration || 0),
    st: Math.max(0, Math.round((payload.startTime || 0) * 10) / 10),
    ls: payload.lines.slice(0, 3),
    m: payload.message.slice(0, 120),
    s: payload.senderName.trim() || 'Seseorang / Secret Admirer',
    b: payload.badge,
  };

  const json = JSON.stringify(wire);
  const encodedBytes = new TextEncoder().encode(json);
  return bytesToUrlSafeBase64(encodedBytes);
}

export function decodeWhisperPayload(encoded: string): WhisperPayload | null {
  try {
    if (!encoded || encoded.trim().length === 0) return null;
    const bytes = urlSafeBase64ToBytes(encoded.trim());
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CompactWhisperWire>;

    if (!parsed || typeof parsed.t !== 'string' || typeof parsed.a !== 'string') {
      return null;
    }

    const normalizedBadge = parsed.b === 'Just Friend 😉' ? 'Just Friend' : parsed.b;
    const validBadge: WhisperBadge = WHISPER_BADGES.includes(normalizedBadge as WhisperBadge)
      ? (normalizedBadge as WhisperBadge)
      : 'Just Friend';

    const lines = Array.isArray(parsed.ls)
      ? parsed.ls.filter((line): line is string => typeof line === 'string' && line.trim().length > 0).slice(0, 3)
      : [];

    return {
      track: {
        id: typeof parsed.id === 'string' && parsed.id ? parsed.id : `whisper-${Date.now()}`,
        title: parsed.t,
        artist: parsed.a,
        album: typeof parsed.al === 'string' ? parsed.al : '',
        coverUrl: typeof parsed.c === 'string' ? parsed.c : '',
        videoId: typeof parsed.vid === 'string' && parsed.vid ? parsed.vid : undefined,
        audioUrl: typeof parsed.au === 'string' && parsed.au ? parsed.au : undefined,
        duration: typeof parsed.d === 'number' && Number.isFinite(parsed.d) ? parsed.d : 0,
      },
      startTime: typeof parsed.st === 'number' && Number.isFinite(parsed.st) ? Math.max(0, parsed.st) : 0,
      lines,
      message: typeof parsed.m === 'string' ? parsed.m.slice(0, 120) : '',
      senderName:
        typeof parsed.s === 'string' && parsed.s.trim()
          ? parsed.s.trim()
          : 'Seseorang / Secret Admirer',
      badge: validBadge,
    };
  } catch {
    return null;
  }
}

export function buildWhisperShareUrl(payload: WhisperPayload): string {
  const token = encodeWhisperPayload(payload);
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('whisper', token);
  return url.toString();
}

export function whisperToTrack(whisper: WhisperPayload): Track {
  return {
    id: whisper.track.id,
    title: whisper.track.title,
    artist: whisper.track.artist,
    album: whisper.track.album || 'Nocty Whisper',
    coverUrl: whisper.track.coverUrl,
    videoId: whisper.track.videoId,
    audioUrl: whisper.track.audioUrl,
    duration: whisper.track.duration || 210,
    sourceType: whisper.track.audioUrl && !whisper.track.videoId ? 'local' : 'online',
    lyrics: [],
    lyricsStatus: 'idle',
    createdAt: Date.now(),
  };
}
