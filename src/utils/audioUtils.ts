import { AmbientColor, AmbientPalette, LyricLine, Track } from '../types/music';

/**
 * True unbiased Fisher-Yates in-place shuffle on a cloned array.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export interface SmartShuffleHistoryItem {
  trackId: string;
  title?: string;
  artist?: string;
  durationListened?: number;
}

export function extractPrimaryArtistName(artist: string): string {
  return artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b/i)[0]
    .trim();
}

export function getPrimaryArtistKey(artist: string): string {
  return extractPrimaryArtistName(artist).toLowerCase();
}

function getTrackMetaKey(artist: string, title: string): string {
  return `${getPrimaryArtistKey(artist)}::${title.toLowerCase().trim()}`;
}

export function collapseRepeatedChars(input: string): string {
  return input.replace(/([a-z0-9])\1+/gi, '$1');
}

export function normalizeTypoSearchText(input: string): string {
  return collapseRepeatedChars(
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a song title cleanly so variants like "Janji Palsu", "Janji Palsu (Cover)",
 * or "Janji Palsu - Live" map to the exact same canonical key.
 */
export function normalizeTitleKey(title: string): string {
  return normalizeTypoSearchText(
    title
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/\s*[-–|]\s*(official|live|acoustic|akustik|cover|remix|koplo|version|versi|karaoke|lyrics?|lirik|audio).*$/i, '')
  );
}

/**
 * Produces a cleaned search query for upstream catalogs when user types repeated-letter typos
 * (e.g. "janjji" -> "janji", "palsuu" -> "palsu", "hindiaa" -> "hindia") while preserving
 * legitimate English double letters like "Billie", "Weeknd", "Espresso", "Good".
 */
export function getTypoQueryVariant(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) return '';
  let cleaned = trimmed.replace(/([a-z])\1{2,}/gi, '$1');
  cleaned = cleaned.replace(/([aiu])\1+/gi, '$1');
  cleaned = cleaned.replace(/([jkhqvwxyz])\1+/gi, '$1');
  cleaned = cleaned.replace(/([bcdfghjklmnpqrstvwxyz])([bcdfghjklmnpqrstvwxyz])\2+/gi, '$1$2');
  cleaned = cleaned.replace(/\b([a-z]*[aiueo])([dfgkmpqrvx])\2+\b/gi, '$1$2');
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Context-aware weighted Smart Shuffle:
 * 1. Avoids placing consecutive tracks by the same primary artist whenever alternatives exist.
 * 2. Weights randomized selection towards tracks with higher listen counts from local history.
 * 3. Preserves randomness via weighted sampling on every shuffle invocation.
 */
export function smartShuffleTracks(
  tracks: Track[],
  listeningHistory: SmartShuffleHistoryItem[] = [],
  anchorTrack?: Track | null
): Track[] {
  if (tracks.length <= 1) return [...tracks];

  const trackListenCounts = new Map<string, number>();
  const metaListenCounts = new Map<string, number>();
  const artistListenCounts = new Map<string, number>();

  for (const entry of listeningHistory) {
    const bonus = (entry.durationListened || 0) >= 60 ? 1.25 : 1;
    trackListenCounts.set(entry.trackId, (trackListenCounts.get(entry.trackId) || 0) + bonus);
    if (entry.artist && entry.title) {
      const mKey = getTrackMetaKey(entry.artist, entry.title);
      metaListenCounts.set(mKey, (metaListenCounts.get(mKey) || 0) + bonus);
    }
    if (entry.artist) {
      const aKey = getPrimaryArtistKey(entry.artist);
      if (aKey) {
        artistListenCounts.set(aKey, (artistListenCounts.get(aKey) || 0) + 1);
      }
    }
  }

  const remaining = fisherYatesShuffle(tracks);
  const result: Track[] = [];
  let lastArtistKey = anchorTrack ? getPrimaryArtistKey(anchorTrack.artist) : '';

  const getTrackWeight = (track: Track): number => {
    const idCount = trackListenCounts.get(track.id) || 0;
    const metaCount = metaListenCounts.get(getTrackMetaKey(track.artist, track.title)) || 0;
    const effectiveListens = Math.max(idCount, metaCount);
    const artistKey = getPrimaryArtistKey(track.artist);
    const artistBonus = artistKey ? Math.min(0.8, (artistListenCounts.get(artistKey) || 0) * 0.15) : 0;
    // Base weight 1.0 ensures unplayed tracks stay in rotation while higher listen counts get boosted up to ~5.8x
    return 1 + Math.min(4.0, effectiveListens * 0.85) + artistBonus;
  };

  while (remaining.length > 0) {
    let poolIndices: number[] = [];
    if (lastArtistKey) {
      for (let i = 0; i < remaining.length; i++) {
        if (getPrimaryArtistKey(remaining[i].artist) !== lastArtistKey) {
          poolIndices.push(i);
        }
      }
    }
    if (poolIndices.length === 0) {
      poolIndices = remaining.map((_, idx) => idx);
    }

    let totalWeight = 0;
    const weights = poolIndices.map((idx) => {
      const w = getTrackWeight(remaining[idx]);
      totalWeight += w;
      return w;
    });

    let roll = Math.random() * totalWeight;
    let chosenPoolPos = poolIndices.length - 1;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        chosenPoolPos = i;
        break;
      }
    }

    const chosenIdx = poolIndices[chosenPoolPos];
    const [picked] = remaining.splice(chosenIdx, 1);
    result.push(picked);
    lastArtistKey = getPrimaryArtistKey(picked.artist);
  }

  return result;
}

export type TrackMoodId = 'melancholic' | 'chill' | 'upbeat' | 'focus';

export interface TrackMoodInfo {
  mood: TrackMoodId;
  label: string;
  badgeText: string;
  emojiUnified: string;
  autoplayHint: string;
}

const MOOD_METADATA: Record<TrackMoodId, Omit<TrackMoodInfo, 'mood'>> = {
  melancholic: {
    label: 'Melancholic & Deep',
    badgeText: 'Vibe: Melancholic & Deep',
    emojiUnified: '1f97a',
    autoplayHint: 'Hindia NIKI Bernadya Tulus sedih galau',
  },
  chill: {
    label: 'Late Night & Chill',
    badgeText: 'Vibe: Late Night & Chill',
    emojiUnified: '1f319',
    autoplayHint: 'SZA Joji Daniel Caesar Frank Ocean midnight chill',
  },
  upbeat: {
    label: 'Upbeat & Euphoria',
    badgeText: 'Vibe: Upbeat & Euphoria',
    emojiUnified: '1f525',
    autoplayHint: 'LANY BIGBANG NewJeans The Weeknd Bruno Mars upbeat',
  },
  focus: {
    label: 'Focus & Instrumental',
    badgeText: 'Vibe: Focus & Instrumental',
    emojiUnified: '1f3a7',
    autoplayHint: 'lofi instrumental acoustic piano ambient study',
  },
};

const MOOD_RULES: Record<
  TrackMoodId,
  { artists: string[]; keywords: string[] }
> = {
  melancholic: {
    artists: [
      'hindia',
      'niki',
      'bernadya',
      'tulus',
      'mahalini',
      'nadin amizah',
      'pamungkas',
      'rizky febian',
      'fiersa besari',
      'juicy luicy',
      'febry putri',
      'feast',
      'for revenge',
      'last child',
      'kunto aji',
      'sal priadi',
      'tiara andini',
      'lyodra',
      'yura yunita',
      'billie eilish',
      'olivia rodrigo',
      'adele',
      'sam smith',
      'lewis capaldi',
      'mitski',
      'conan gray',
    ],
    keywords: [
      'sedih',
      'pergi',
      'hilang',
      'rindu',
      'hujan',
      'luka',
      'rumah',
      'broken',
      'sad',
      'cry',
      'tears',
      'alone',
      'hurt',
      'empty',
      'leave',
      'goodbye',
      'kecewa',
      'sakit',
      'sepi',
      'kenangan',
      'menangis',
      'patah',
      'tangis',
      'lupa',
      'menyesal',
      'sendiri',
      'bayang',
      'jarak',
      'heartbreak',
      'lonely',
      'sorry',
      'miss you',
      'grief',
      'pain',
      'galau',
      'secukupnya',
      'evaluasi',
      'monokrom',
      'sial',
      'tak ingin usai',
      'untungnya',
    ],
  },
  chill: {
    artists: [
      'sza',
      'joji',
      'daniel caesar',
      'frank ocean',
      'rex orange county',
      'keshi',
      'reality club',
      'cigarettes after sex',
      'mac ayres',
      'kali uchis',
      'brent faiyaz',
      'giveon',
      'clairo',
      'laufey',
      'the marias',
      'the marías',
      'nadhif basalamah',
      'ardhito pramono',
      'raisa',
      'afgan',
      'isyana',
    ],
    keywords: [
      'night',
      'midnight',
      'dream',
      'slow',
      'sleep',
      'ocean',
      'moon',
      'late',
      'chill',
      'rain',
      'stars',
      'quiet',
      'malam',
      'sunyi',
      'tenang',
      'coffee',
      'velvet',
      'shadow',
      'drift',
      'breeze',
      'sunset',
      'twilight',
      'soft',
      'warm',
      'penjaga hati',
      'senja',
      'larut',
      'angin',
      'pelan',
      'rebahan',
    ],
  },
  upbeat: {
    artists: [
      'lany',
      'bigbang',
      'newjeans',
      'blackpink',
      'dua lipa',
      'the weeknd',
      'bruno mars',
      'bts',
      'coldplay',
      'sabrina carpenter',
      'taylor swift',
      'harry styles',
      'ariana grande',
      'maroon 5',
      'jungkook',
      'stray kids',
      'seventeen',
      'twice',
      'aespa',
      'ive',
      'charli xcx',
      'doja cat',
      'post malone',
    ],
    keywords: [
      'love',
      'party',
      'dance',
      'summer',
      'high',
      'happy',
      'fire',
      'shine',
      'wild',
      'tonight',
      'energy',
      'groove',
      'euphoria',
      'cinta',
      'menari',
      'disco',
      'electric',
      'club',
      'kiss',
      'starboy',
      'blinding',
      'espresso',
      'dynamite',
      'bang',
      'magic',
      'celebrate',
      'fun',
      'good',
      'glow',
      'rush',
      'semangat',
      'bahagia',
    ],
  },
  focus: {
    artists: [
      'ludovico einaudi',
      'yiruma',
      'joe hisaishi',
      'max richter',
      'nils frahm',
      'chilledcow',
      'lofi girl',
      'nujabes',
      'jinsang',
    ],
    keywords: [
      'instrumental',
      'piano',
      'lo-fi',
      'lofi',
      'acoustic',
      'study',
      'ambient',
      'classical',
      'soundtrack',
      'akustik',
      'orchestra',
      'symphony',
      'beats',
      'chillhop',
      'meditation',
      'relaxing',
      'focus',
      'score',
      'prelude',
      'nocturne',
      'sonata',
      'unplugged',
      'stripped',
    ],
  },
};

function countKeywordMatches(haystack: string, keyword: string): number {
  if (!haystack || !keyword) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'gi');
  const matches = haystack.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Classifies a track into one of 4 emotional/vibe spectrums using title, artist, album, and lyrics.
 */
export function detectTrackMood(track: Track, lyricsText?: string): TrackMoodInfo {
  const titleText = (track.title || '').toLowerCase();
  const artistText = (track.artist || '').toLowerCase();
  const albumText = (track.album || '').toLowerCase();
  const metaText = `${titleText} ${artistText} ${albumText}`;
  const combinedLyrics = (
    lyricsText ||
    track.plainLyrics ||
    track.lyrics.map((l) => l.text).join(' ')
  ).toLowerCase();

  const scores: Record<TrackMoodId, number> = {
    melancholic: 0,
    chill: 0,
    upbeat: 0,
    focus: 0,
  };

  (Object.keys(MOOD_RULES) as TrackMoodId[]).forEach((moodId) => {
    const rule = MOOD_RULES[moodId];

    for (const artistKey of rule.artists) {
      if (artistText.includes(artistKey)) {
        scores[moodId] += 5;
      }
    }

    for (const kw of rule.keywords) {
      const metaHits = countKeywordMatches(metaText, kw);
      if (metaHits > 0) {
        scores[moodId] += moodId === 'focus' ? 6 : 3.5;
      }
      if (combinedLyrics) {
        const lyricHits = Math.min(3, countKeywordMatches(combinedLyrics, kw));
        if (lyricHits > 0) {
          scores[moodId] += lyricHits * 1.3;
        }
      }
    }
  });

  const priorityOrder: TrackMoodId[] = ['focus', 'melancholic', 'chill', 'upbeat'];
  let bestMood: TrackMoodId = 'chill';
  let bestScore = 0;

  for (const moodId of priorityOrder) {
    if (scores[moodId] > bestScore) {
      bestScore = scores[moodId];
      bestMood = moodId;
    }
  }

  return {
    mood: bestMood,
    ...MOOD_METADATA[bestMood],
  };
}

/**
 * Builds an Emotion-Aware mixed queue:
 * 1. Places `anchorTrack` strictly at index 0 (#1).
 * 2. Places tracks sharing the same mood immediately at #2, #3, #4..., spacing consecutive same-artist tracks when possible.
 * 3. Appends remaining tracks from candidates/extraPool without duplicates.
 */
export function mixTracksByMood(
  anchorTrack: Track,
  candidates: Track[],
  extraPool: Track[] = []
): Track[] {
  const anchorMood = detectTrackMood(anchorTrack).mood;
  const dedupedMap = new Map<string, Track>();

  for (const t of [...candidates, ...extraPool]) {
    if (t && t.id && t.id !== anchorTrack.id && !dedupedMap.has(t.id)) {
      dedupedMap.set(t.id, t);
    }
  }

  const sameMood: Track[] = [];
  const otherMood: Track[] = [];

  for (const t of dedupedMap.values()) {
    if (detectTrackMood(t).mood === anchorMood) {
      sameMood.push(t);
    } else {
      otherMood.push(t);
    }
  }

  // Lightly spread consecutive identical primary artists inside the same-mood front cluster
  const spacedSameMood: Track[] = [];
  const remainingSame = [...sameMood];
  let prevArtist = getPrimaryArtistKey(anchorTrack.artist);

  while (remainingSame.length > 0) {
    const diffIdx = prevArtist
      ? remainingSame.findIndex((t) => getPrimaryArtistKey(t.artist) !== prevArtist)
      : 0;
    const pickIdx = diffIdx !== -1 ? diffIdx : 0;
    const [picked] = remainingSame.splice(pickIdx, 1);
    spacedSameMood.push(picked);
    prevArtist = getPrimaryArtistKey(picked.artist);
  }

  return [anchorTrack, ...spacedSameMood, ...otherMood];
}

const VIBE_ARTIST_CLUSTERS: Array<{ members: string[]; peers: string[] }> = [
  {
    // Indie / Pop Alternatif Indonesia
    members: [
      'hindia',
      '.feast',
      'feast',
      'nadin amizah',
      'tulus',
      'sal priadi',
      'pamungkas',
      'feby putri',
      'kunto aji',
      'reality club',
      'fourtwnty',
      'payung teduh',
      'danilla',
      'efek rumah kaca',
      'barasuara',
      'perunggu',
      'the adams',
      'ardhito pramono',
      'nadhif basalamah',
      'dere',
      'idgitaf',
    ],
    peers: [
      'Tulus',
      'Nadin Amizah',
      'Sal Priadi',
      'Pamungkas',
      'Feby Putri',
      '.Feast',
      'Hindia',
      'Bernadya',
      'Reality Club',
      'Kunto Aji',
    ],
  },
  {
    // Pop Galau / Ballad Indonesia
    members: [
      'bernadya',
      'mahalini',
      'lyodra',
      'tiara andini',
      'rizky febian',
      'juicy luicy',
      'fabio asher',
      'anggi marito',
      'keisya levronka',
      'ziva magnolya',
      'raisa',
      'yura yunita',
      'afgan',
      'rossa',
      'judika',
      'budi doremi',
      'virgoun',
      'last child',
      'for revenge',
      'fiersa besari',
    ],
    peers: [
      'Bernadya',
      'Mahalini',
      'Tulus',
      'Juicy Luicy',
      'Lyodra',
      'Tiara Andini',
      'Nadin Amizah',
      'Rizky Febian',
      'Yura Yunita',
      'Fabio Asher',
    ],
  },
  {
    // Band Pop / Rock Klasik Indonesia
    members: [
      'sheila on 7',
      'dewa 19',
      'dewa',
      'noah',
      'peterpan',
      'padi',
      'gigi',
      'ungu',
      'slank',
      'nidji',
      'ada band',
      'letto',
      'd masiv',
      'samsons',
      'kangen band',
      'armada',
      'wali',
      'st12',
      'kerispatih',
    ],
    peers: [
      'Sheila On 7',
      'Dewa 19',
      'NOAH',
      'Peterpan',
      'Padi',
      'Ungu',
      'Nidji',
      'Ada Band',
      'Letto',
      'D Masiv',
    ],
  },
  {
    // Dangdut / Koplo / Pop Jawa
    members: [
      'denny caknan',
      'happy asmara',
      'ndarboy genk',
      'guyon waton',
      'aftershine',
      'gilga sahid',
      'difarina indra',
      'niken salindry',
      'didi kempot',
      'via vallen',
      'nella kharisma',
      'lesti',
      'rhoma irama',
    ],
    peers: [
      'Denny Caknan',
      'Happy Asmara',
      'Ndarboy Genk',
      'Guyon Waton',
      'Aftershine',
      'Gilga Sahid',
      'Didi Kempot',
    ],
  },
  {
    // K-Pop / K-R&B
    members: [
      'newjeans',
      'bts',
      'blackpink',
      'bigbang',
      'twice',
      'seventeen',
      'aespa',
      'ive',
      'stray kids',
      'jungkook',
      'iu',
      'exo',
      'nct',
      'le sserafim',
      'txt',
      'enhypen',
      'dean',
      'crush',
      'baekhyun',
    ],
    peers: [
      'NewJeans',
      'BTS',
      'BLACKPINK',
      'SEVENTEEN',
      'TWICE',
      'aespa',
      'IVE',
      'IU',
      'BIGBANG',
      'Stray Kids',
    ],
  },
  {
    // Western Indie / R&B / Lo-Fi / Bedroom Pop
    members: [
      'niki',
      'rich brian',
      'joji',
      'sza',
      'daniel caesar',
      'frank ocean',
      'keshi',
      'clairo',
      'laufey',
      'cigarettes after sex',
      'rex orange county',
      'mac ayres',
      'kali uchis',
      'giveon',
      'brent faiyaz',
      'the marias',
      'the marías',
      'stephanie poetri',
    ],
    peers: [
      'NIKI',
      'Joji',
      'SZA',
      'Daniel Caesar',
      'Keshi',
      'Frank Ocean',
      'Laufey',
      'Clairo',
      'Rex Orange County',
      'Cigarettes After Sex',
    ],
  },
  {
    // Western Pop / Alt-Rock
    members: [
      'the weeknd',
      'bruno mars',
      'dua lipa',
      'taylor swift',
      'sabrina carpenter',
      'billie eilish',
      'olivia rodrigo',
      'harry styles',
      'ariana grande',
      'lany',
      'coldplay',
      'arctic monkeys',
      'radiohead',
      'john mayer',
      'oasis',
      'maroon 5',
      'post malone',
      'ed sheeran',
      'adele',
      'sam smith',
    ],
    peers: [
      'The Weeknd',
      'Bruno Mars',
      'LANY',
      'Dua Lipa',
      'Billie Eilish',
      'Taylor Swift',
      'Sabrina Carpenter',
      'Coldplay',
      'Arctic Monkeys',
      'Harry Styles',
    ],
  },
];

/**
 * Returns 6-8 genre & vibe-aligned companion artists for a given track,
 * strictly excluding the track's own primary artist.
 */
export function getSimilarArtistsForTrack(track: Track): string[] {
  const artistKey = getPrimaryArtistKey(track.artist);
  const fullArtistLower = (track.artist || '').toLowerCase();

  for (const cluster of VIBE_ARTIST_CLUSTERS) {
    const matchesCluster = cluster.members.some(
      (m) => artistKey === m || artistKey.includes(m) || fullArtistLower.includes(m)
    );
    if (matchesCluster) {
      return cluster.peers
        .filter((p) => getPrimaryArtistKey(p) !== artistKey)
        .slice(0, 8);
    }
  }

  const mood = detectTrackMood(track).mood;
  const fallbackByMood: Record<TrackMoodId, string[]> = {
    melancholic: ['Hindia', 'Tulus', 'Nadin Amizah', 'Bernadya', 'Sal Priadi', 'Pamungkas', 'Feby Putri', '.Feast'],
    chill: ['Joji', 'SZA', 'Daniel Caesar', 'Keshi', 'Reality Club', 'Ardhito Pramono', 'Laufey', 'NIKI'],
    upbeat: ['The Weeknd', 'Bruno Mars', 'LANY', 'Dua Lipa', 'NewJeans', 'Sheila On 7', 'Sabrina Carpenter'],
    focus: ['Ludovico Einaudi', 'Yiruma', 'Joe Hisaishi', 'Nujabes', 'Max Richter', 'Nils Frahm'],
  };

  return fallbackByMood[mood]
    .filter((p) => getPrimaryArtistKey(p) !== artistKey)
    .slice(0, 8);
}

/**
 * Formats seconds into mm:ss with tabular-friendly zero padding.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Decodes common HTML entities returned by metadata APIs.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Parses standard LRC format strings ("[01:23.45] Lyric line") into sorted LyricLine[].
 */
export function parseLrcLyrics(lrc: string): LyricLine[] {
  if (!lrc) return [];
  const lines = lrc.split(/\r?\n/);
  const parsed: LyricLine[] = [];
  const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const matches = Array.from(rawLine.matchAll(timestampRegex));
    if (matches.length === 0) continue;

    const text = rawLine.replace(timestampRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fractionRaw = match[3] || '0';
      const fraction =
        fractionRaw.length === 3
          ? parseInt(fractionRaw, 10) / 1000
          : fractionRaw.length === 2
            ? parseInt(fractionRaw, 10) / 100
            : parseInt(fractionRaw, 10) / 10;

      const time = minutes * 60 + seconds + fraction;
      if (Number.isFinite(time)) {
        parsed.push({ time, text });
      }
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Cleans track metadata noise for accurate LRCLIB lookups.
 */
export function cleanTrackMetaForLyrics(artist: string, title: string): { artist: string; title: string } {
  const cleanArtist = decodeHtmlEntities(artist)
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0]
    .trim();

  const cleanTitle = decodeHtmlEntities(title)
    .replace(/\s*\((From|Official|Audio|Music Video|Lyric Video|Lyrics|Visualizer|HD|HQ|Live|Explicit).*?\)/gi, '')
    .replace(/\s*\[(Official|Audio|Music Video|Lyric Video|Lyrics|Visualizer|HD|HQ|Live|Explicit).*?\]/gi, '')
    .replace(/\s*\((feat\.|ft\.|with)\s+[^)]+\)/gi, '')
    .replace(/\s*-\s*(Official|Lyrics|Audio).*$/gi, '')
    .trim();

  return {
    artist: cleanArtist || artist.trim(),
    title: cleanTitle || title.trim(),
  };
}

function getRelativeLuminance(c: AmbientColor): number {
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

export function buildAmbientPalette(
  primary: AmbientColor,
  secondary: AmbientColor,
  vibrancy = 0.45,
  avgCoverLum = 0.45
): AmbientPalette {
  const clampedVib = Math.max(0, Math.min(1, vibrancy));
  const clampedLum = Math.max(0.1, Math.min(0.9, avgCoverLum));
  // Rich vibrant artwork drives deeper ambient aura intensity; darker/muted covers stay restrained
  const rawIntensity = 0.22 + clampedVib * 0.28 + (1 - Math.abs(clampedLum - 0.5)) * 0.06;
  const gradientIntensity = Number(Math.max(0.2, Math.min(0.56, rawIntensity)).toFixed(2));
  const accentContrast: '#0B0B0D' | '#FFFFFF' =
    getRelativeLuminance(primary) > 0.52 ? '#0B0B0D' : '#FFFFFF';

  return {
    primary,
    secondary,
    vibrancy: Number(clampedVib.toFixed(2)),
    gradientIntensity,
    accentContrast,
  };
}

export const DEFAULT_AMBIENT_PALETTE: AmbientPalette = buildAmbientPalette(
  { r: 161, g: 161, b: 170, hex: '#A1A1AA' },
  { r: 82, g: 82, b: 91, hex: '#52525B' },
  0.12,
  0.22
);

const FALLBACK_PALETTES: AmbientPalette[] = [
  DEFAULT_AMBIENT_PALETTE,
  buildAmbientPalette(
    { r: 192, g: 132, b: 151, hex: '#C08497' },
    { r: 100, g: 116, b: 139, hex: '#64748B' },
    0.42,
    0.48
  ),
  buildAmbientPalette(
    { r: 96, g: 165, b: 250, hex: '#60A5FA' },
    { r: 45, g: 212, b: 191, hex: '#2DD4BF' },
    0.64,
    0.55
  ),
  buildAmbientPalette(
    { r: 217, g: 119, b: 87, hex: '#D97757' },
    { r: 129, g: 140, b: 248, hex: '#818CF8' },
    0.62,
    0.52
  ),
  buildAmbientPalette(
    { r: 167, g: 139, b: 250, hex: '#A78BFA' },
    { r: 56, g: 189, b: 248, hex: '#38BDF8' },
    0.66,
    0.56
  ),
];

function deterministicPalette(key: string): AmbientPalette {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_PALETTES[Math.abs(hash) % FALLBACK_PALETTES.length];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeSoftAmbient(r: number, g: number, b: number): AmbientColor {
  // Keep ambient light luminous enough on #0B0B0D without becoming harsh neon
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  let nr = r;
  let ng = g;
  let nb = b;

  if (lum < 0.36) {
    const lift = 0.42 / Math.max(0.12, lum);
    nr = Math.min(225, nr * lift);
    ng = Math.min(225, ng * lift);
    nb = Math.min(225, nb * lift);
  } else if (lum > 0.78) {
    const damp = 0.72 / lum;
    nr *= damp;
    ng *= damp;
    nb *= damp;
  }

  // Gently blend 12% toward neutral silver-white for Apple-like atmospheric softness
  nr = Math.round(nr * 0.88 + 210 * 0.12);
  ng = Math.round(ng * 0.88 + 215 * 0.12);
  nb = Math.round(nb * 0.88 + 225 * 0.12);

  return { r: nr, g: ng, b: nb, hex: rgbToHex(nr, ng, nb) };
}

function colorDistance(a: AmbientColor, b: AmbientColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Extracts 2 soft dominant colors from an album cover via offscreen canvas
 * using 12 hue buckets + neutral fallback so ambient radial meshes reflect the album mood.
 */
export function extractCoverAmbientPalette(
  imageUrl: string,
  fallbackKey: string
): Promise<AmbientPalette> {
  if (!imageUrl) {
    return Promise.resolve(deterministicPalette(fallbackKey));
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = window.setTimeout(() => {
      resolve(deterministicPalette(fallbackKey));
    }, 2200);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const size = 28;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(deterministicPalette(fallbackKey));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = Array.from({ length: 12 }, () => ({
          rSum: 0,
          gSum: 0,
          bSum: 0,
          weight: 0,
        }));

        let allR = 0;
        let allG = 0;
        let allB = 0;
        let allW = 0;
        let satSum = 0;
        let lumSum = 0;
        let validSamples = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const sat = max === 0 ? 0 : delta / max;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          if (lum < 0.08 || lum > 0.94) continue;

          satSum += sat;
          lumSum += lum;
          validSamples += 1;

          const baseW = 0.25 + sat * 2.2;
          allR += r * baseW;
          allG += g * baseW;
          allB += b * baseW;
          allW += baseW;

          if (delta < 12) continue;

          let hue = 0;
          if (max === r) {
            hue = ((g - b) / delta) % 6;
          } else if (max === g) {
            hue = (b - r) / delta + 2;
          } else {
            hue = (r - g) / delta + 4;
          }
          hue = ((hue * 60) + 360) % 360;
          const bucketIdx = Math.floor(hue / 30) % 12;

          buckets[bucketIdx].rSum += r * baseW;
          buckets[bucketIdx].gSum += g * baseW;
          buckets[bucketIdx].bSum += b * baseW;
          buckets[bucketIdx].weight += baseW;
        }

        const avgSat = validSamples > 0 ? satSum / validSamples : 0.35;
        const avgLum = validSamples > 0 ? lumSum / validSamples : 0.45;
        const sortedBuckets = buckets
          .filter((b) => b.weight > 0.5)
          .sort((a, b) => b.weight - a.weight);

        if (sortedBuckets.length === 0) {
          if (allW > 0.5) {
            const single = normalizeSoftAmbient(allR / allW, allG / allW, allB / allW);
            const alt = normalizeSoftAmbient(
              (allR / allW) * 0.75 + 90,
              (allG / allW) * 0.8 + 100,
              (allB / allW) * 0.95 + 140
            );
            resolve(buildAmbientPalette(single, alt, avgSat * 0.7, avgLum));
            return;
          }
          resolve(deterministicPalette(fallbackKey));
          return;
        }

        const b1 = sortedBuckets[0];
        const primary = normalizeSoftAmbient(
          b1.rSum / b1.weight,
          b1.gSum / b1.weight,
          b1.bSum / b1.weight
        );

        let secondary: AmbientColor | null = null;
        for (let idx = 1; idx < sortedBuckets.length; idx++) {
          const candBucket = sortedBuckets[idx];
          const cand = normalizeSoftAmbient(
            candBucket.rSum / candBucket.weight,
            candBucket.gSum / candBucket.weight,
            candBucket.bSum / candBucket.weight
          );
          if (colorDistance(primary, cand) > 42) {
            secondary = cand;
            break;
          }
        }

        if (!secondary) {
          // Synthesize a complementary soft tonal counterpart from primary
          secondary = normalizeSoftAmbient(
            Math.max(40, Math.min(230, primary.b * 0.9 + 25)),
            Math.max(40, Math.min(230, primary.r * 0.6 + primary.g * 0.4)),
            Math.max(40, Math.min(230, primary.g * 0.55 + primary.b * 0.55 + 30))
          );
        }

        const spreadFactor = Math.min(1, sortedBuckets.length / 6);
        const vibrancy = Math.min(1, avgSat * 1.15 + spreadFactor * 0.18);
        resolve(buildAmbientPalette(primary, secondary, vibrancy, avgLum));
      } catch {
        resolve(deterministicPalette(fallbackKey));
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(deterministicPalette(fallbackKey));
    };

    img.src = imageUrl;
  });
}

const squircleArtworkCache = new Map<string, string>();

function traceSquirclePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number
) {
  // Continuous Apple-style squircle curve (slightly smoother than circular arc)
  const r = Math.min(radius, size * 0.45);
  const c = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.bezierCurveTo(x + size - c, y, x + size, y + c, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.bezierCurveTo(x + size, y + size - c, x + size - c, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.bezierCurveTo(x + c, y + size, x, y + size - c, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.bezierCurveTo(x, y + c, x + c, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders an album cover onto a hidden 512x512 HTML5 Canvas with Apple-style squircle corners
 * so Android/iOS lockscreen & Control Center cards look crisp and clean.
 */
export function generateSquircleArtworkDataUrl(
  imageUrl: string,
  size = 512
): Promise<string> {
  if (!imageUrl) return Promise.resolve(imageUrl);
  const cacheKey = `${size}::${imageUrl}`;
  const cached = squircleArtworkCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = window.setTimeout(() => {
      resolve(imageUrl);
    }, 2600);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        const radius = Math.round(size * 0.22);
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        traceSquirclePath(ctx, 0, 0, size, radius);
        ctx.clip();

        // Center-crop square cover fit
        const iw = img.naturalWidth || img.width || size;
        const ih = img.naturalHeight || img.height || size;
        const scale = Math.max(size / iw, size / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const dx = (size - drawW) / 2;
        const dy = (size - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);

        // Subtle inner Apple glass highlight border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = Math.max(2, Math.round(size * 0.004));
        traceSquirclePath(ctx, 1, 1, size - 2, Math.max(8, radius - 1));
        ctx.stroke();
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/png');
        if (squircleArtworkCache.size >= 30) {
          const oldestKey = squircleArtworkCache.keys().next().value;
          if (oldestKey) squircleArtworkCache.delete(oldestKey);
        }
        squircleArtworkCache.set(cacheKey, dataUrl);
        resolve(dataUrl);
      } catch {
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
}
