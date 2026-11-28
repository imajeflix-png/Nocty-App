import { Track } from '../types/music';
import { detectTrackMood } from './audioUtils';

export type SlipTemplateId =
  | 'denim-patches'
  | 'gingham-clip'
  | 'editorial-basket'
  | 'nocturnal-aura';

export interface SlipSafeZone {
  topPct: number;
  leftPct: number;
  widthPct: number;
  heightPct: number;
  rotateDeg: number;
  padXPx?: number;
  padRightPx?: number;
  padYPx?: number;
}

export interface SlipTemplateConfig {
  id: SlipTemplateId;
  kind: 'image' | 'glass-aura';
  name: string;
  subtitle: string;
  vibeSummary: string;
  imageUrl?: string;
  maxTracks: number;
  barcodeHeightPx: number;
  safeZone: SlipSafeZone;
}

export const SLIP_TEMPLATES: Record<SlipTemplateId, SlipTemplateConfig> = {
  'denim-patches': {
    id: 'denim-patches',
    kind: 'image',
    name: 'Denim Patches',
    subtitle: 'Upbeat · Pop · Hip-Hop',
    vibeSummary: 'Upbeat, Pop, Hip-Hop & Indie Enerjik',
    imageUrl: '/slip-templates/denim-patches.webp',
    maxTracks: 3,
    barcodeHeightPx: 22,
    safeZone: {
      topPct: 33.5,
      leftPct: 23,
      widthPct: 54,
      heightPct: 26.5,
      rotateDeg: 0,
      padXPx: 10,
      padRightPx: 10,
      padYPx: 4,
    },
  },
  'gingham-clip': {
    id: 'gingham-clip',
    kind: 'image',
    name: 'Gingham Clip',
    subtitle: 'Rock · Alternatif · Indie',
    vibeSummary: 'Rock, Alternatif, Indie Tegas & Acoustic Santai',
    imageUrl: '/slip-templates/gingham-clip.webp',
    maxTracks: 6,
    barcodeHeightPx: 28,
    safeZone: {
      topPct: 31.5,
      leftPct: 16.5,
      widthPct: 67,
      heightPct: 41.5,
      rotateDeg: -1.5,
      padXPx: 12,
      padRightPx: 12,
      padYPx: 5,
    },
  },
  'editorial-basket': {
    id: 'editorial-basket',
    kind: 'image',
    name: 'Editorial Basket',
    subtitle: 'Galau · Lo-Fi · Chill',
    vibeSummary: 'Galau, Lo-Fi, Chill, Study/Focus & Ballad',
    imageUrl: '/slip-templates/editorial-basket.webp',
    maxTracks: 4,
    barcodeHeightPx: 24,
    safeZone: {
      topPct: 35.5,
      leftPct: 21.5,
      widthPct: 57,
      heightPct: 33,
      rotateDeg: 2.5,
      padXPx: 10,
      padRightPx: 10,
      padYPx: 4,
    },
  },
  'nocturnal-aura': {
    id: 'nocturnal-aura',
    kind: 'glass-aura',
    name: 'Nocturnal Aura',
    subtitle: 'Dark Glass · Mood Aura',
    vibeSummary: 'Dark Apple Liquid Glass dengan Pendaran Aura Sesuai Mood',
    maxTracks: 5,
    barcodeHeightPx: 42,
    safeZone: {
      topPct: 5,
      leftPct: 7,
      widthPct: 86,
      heightPct: 90,
      rotateDeg: 0,
      padXPx: 16,
      padRightPx: 16,
      padYPx: 16,
    },
  },
};

export const SLIP_TEMPLATE_LIST: SlipTemplateConfig[] = [
  SLIP_TEMPLATES['denim-patches'],
  SLIP_TEMPLATES['gingham-clip'],
  SLIP_TEMPLATES['editorial-basket'],
  SLIP_TEMPLATES['nocturnal-aura'],
];

const GINGHAM_ROCK_ALT_INDIE_ARTISTS = [
  '.feast',
  'feast',
  'hindia',
  'efek rumah kaca',
  'barasuara',
  'perunggu',
  'the adams',
  'reality club',
  'sheila on 7',
  'dewa 19',
  'dewa',
  'payung teduh',
  'fourtwnty',
  'jason ranti',
  'fiersa besari',
  'danilla',
  'dialogue',
  'arctic monkeys',
  'radiohead',
  'nirvana',
  'oasis',
  'green day',
  'linkin park',
  'my chemical romance',
  'foo fighters',
  'the strokes',
  'tame impala',
  'paramore',
  'coldplay',
  'john mayer',
  'fleetwood mac',
];

const GINGHAM_ROCK_ALT_KEYWORDS = [
  'rock',
  'alternatif',
  'alternative',
  'punk',
  'grunge',
  'acoustic',
  'akustik',
  'unplugged',
  'evaluasi',
  'secukupnya',
  'peradaban',
  'nina',
  'rumah ke rumah',
  'berita kehilangan',
  'tarian penghancur raya',
  'minggu',
  'kritik',
  'marching',
];

const DENIM_UPBEAT_ARTISTS = [
  'newjeans',
  'bts',
  'blackpink',
  'bigbang',
  'twice',
  'the weeknd',
  'bruno mars',
  'dua lipa',
  'lany',
  'harry styles',
  'sabrina carpenter',
  'charli xcx',
  'kendrick lamar',
  'drake',
  'travis scott',
  'tyler, the creator',
  'rich brian',
  'warren hue',
  'ramengvrl',
  'tuan tigabelas',
  'maliq',
  'ran',
  'hivi',
  'weird genius',
];

const DENIM_UPBEAT_KEYWORDS = [
  'pop',
  'hip-hop',
  'hip hop',
  'rap',
  'dance',
  'disco',
  'funk',
  'remix',
  'party',
  'upbeat',
  'groovy',
  'hype',
  'enerjik',
  'club',
];

const EDITORIAL_GALAU_LOFI_KEYWORDS = [
  'galau',
  'lofi',
  'lo-fi',
  'chill',
  'study',
  'focus',
  'ballad',
  'sedih',
  'rain',
  'hujan',
  'piano',
  'sleep',
  'midnight',
  'rindu',
  'sepi',
  'sial',
  'tak ingin usai',
  'untungnya',
];

const NOCTURNAL_AURA_KEYWORDS = [
  'dream',
  'dreamer',
  'aura',
  'malam',
  'senja',
  'nocturnal',
  'after hours',
  'starlight',
  'moonlight',
  'velvet',
  'night',
  'bintang',
  'bulan',
];

export interface VibeMatchResult {
  templateId: SlipTemplateId;
  reason: string;
}

export function detectSlipTemplateForTrack(track: Track | null | undefined): VibeMatchResult {
  if (!track) {
    return {
      templateId: 'editorial-basket',
      reason: 'Default suasana Chill & Editorial',
    };
  }

  const haystack = `${track.title} ${track.artist} ${track.album || ''}`.toLowerCase();

  // 1. Check Gingham Clip (Rock / Alternatif / Indie Tegas / Acoustic Santai)
  if (
    GINGHAM_ROCK_ALT_INDIE_ARTISTS.some((a) => haystack.includes(a)) ||
    GINGHAM_ROCK_ALT_KEYWORDS.some((kw) => haystack.includes(kw))
  ) {
    return {
      templateId: 'gingham-clip',
      reason: 'Cocok untuk Rock, Alternatif & Indie Tegas',
    };
  }

  // 2. Check Nocturnal Aura (Dark Glassmorphism / Dreamy / Late Night Aura)
  if (NOCTURNAL_AURA_KEYWORDS.some((kw) => haystack.includes(kw))) {
    return {
      templateId: 'nocturnal-aura',
      reason: 'Cocok untuk Dark Glass & Soft Hearted Dreamer',
    };
  }

  // 3. Check Denim Patches (Upbeat / Pop / Hip-Hop / Indie Enerjik)
  const mood = detectTrackMood(track);
  if (
    DENIM_UPBEAT_ARTISTS.some((a) => haystack.includes(a)) ||
    DENIM_UPBEAT_KEYWORDS.some((kw) => haystack.includes(kw)) ||
    mood.mood === 'upbeat'
  ) {
    return {
      templateId: 'denim-patches',
      reason: 'Cocok untuk Upbeat, Pop & Hip-Hop Enerjik',
    };
  }

  // 4. Check Editorial Basket (Galau / Lo-Fi / Chill / Study / Ballad)
  if (
    EDITORIAL_GALAU_LOFI_KEYWORDS.some((kw) => haystack.includes(kw)) ||
    mood.mood === 'melancholic' ||
    mood.mood === 'chill' ||
    mood.mood === 'focus'
  ) {
    const reasonMap: Record<'melancholic' | 'chill' | 'focus', string> = {
      melancholic: 'Cocok untuk Galau & Ballad',
      chill: 'Cocok untuk Chill & Late Night',
      focus: 'Cocok untuk Lo-Fi & Study/Focus',
    };
    return {
      templateId: 'editorial-basket',
      reason: reasonMap[mood.mood],
    };
  }

  return {
    templateId: 'editorial-basket',
    reason: 'Cocok untuk Chill & Editorial',
  };
}
