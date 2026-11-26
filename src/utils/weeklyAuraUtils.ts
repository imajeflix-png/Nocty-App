import { AmbientPalette, Track } from '../types/music';
import { ListeningHistoryEntry } from '../services/storageDb';
import { EMERGENCY_FALLBACK_TRACKS } from '../data/moods';
import { buildAmbientPalette } from './audioUtils';

export interface WeeklyTopTrack {
  trackId: string;
  title: string;
  artist: string;
  artwork: string;
  playCount: number;
  totalSeconds: number;
}

export interface WeeklyTopArtist {
  artist: string;
  artwork: string;
  playCount: number;
  totalSeconds: number;
}

export interface WeeklyAuraReport {
  hasEnoughData: boolean;
  uniqueTrackCount: number;
  totalPlays: number;
  totalSeconds: number;
  totalHours: number;
  remainingMinutes: number;
  formattedTotalTime: string;
  personaLabel: string;
  personaRange: string;
  personaDescription: string;
  personaUnified: string;
  auraTitle: string;
  auraNarrative: string;
  auraPalette: AmbientPalette;
  topTracks: WeeklyTopTrack[];
  topArtists: WeeklyTopArtist[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function analyzeWeeklyAura(history: ListeningHistoryEntry[]): WeeklyAuraReport {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const weekEntries = history.filter(
    (entry) => entry.timestamp >= cutoff && entry.durationListened >= 20
  );

  const totalSeconds = weekEntries.reduce(
    (sum, entry) => sum + Math.max(0, Math.round(entry.durationListened)),
    0
  );
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const formattedTotalTime =
    totalHours > 0
      ? `${totalHours} Jam ${remainingMinutes} Menit`
      : `${remainingMinutes} Menit`;

  // Group Top Tracks
  const trackMap = new Map<string, WeeklyTopTrack>();
  const artistMap = new Map<string, WeeklyTopArtist>();

  for (const entry of weekEntries) {
    const tKey = `${entry.title.toLowerCase()}::${entry.artist.toLowerCase()}`;
    const existingTrack = trackMap.get(tKey);
    if (existingTrack) {
      existingTrack.playCount += 1;
      existingTrack.totalSeconds += entry.durationListened;
      if (!existingTrack.artwork && entry.artwork) {
        existingTrack.artwork = entry.artwork;
      }
    } else {
      trackMap.set(tKey, {
        trackId: entry.trackId,
        title: entry.title,
        artist: entry.artist,
        artwork: entry.artwork,
        playCount: 1,
        totalSeconds: entry.durationListened,
      });
    }

    const aKey = entry.artist.toLowerCase();
    const existingArtist = artistMap.get(aKey);
    if (existingArtist) {
      existingArtist.playCount += 1;
      existingArtist.totalSeconds += entry.durationListened;
      if (!existingArtist.artwork && entry.artwork) {
        existingArtist.artwork = entry.artwork;
      }
    } else {
      artistMap.set(aKey, {
        artist: entry.artist,
        artwork: entry.artwork,
        playCount: 1,
        totalSeconds: entry.durationListened,
      });
    }
  }

  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.playCount - a.playCount || b.totalSeconds - a.totalSeconds)
    .slice(0, 3);

  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.playCount - a.playCount || b.totalSeconds - a.totalSeconds)
    .slice(0, 3);

  // Determine Listening Persona by time-of-day buckets
  const buckets = {
    nightOwl: 0, // 23:00 - 04:59
    morning: 0, // 05:00 - 10:59
    midday: 0, // 11:00 - 15:59
    goldenHour: 0, // 16:00 - 19:59
    velvetEvening: 0, // 20:00 - 22:59
  };

  for (const entry of weekEntries) {
    const hour = new Date(entry.timestamp).getHours();
    if (hour >= 23 || hour < 5) buckets.nightOwl += entry.durationListened;
    else if (hour >= 5 && hour < 11) buckets.morning += entry.durationListened;
    else if (hour >= 11 && hour < 16) buckets.midday += entry.durationListened;
    else if (hour >= 16 && hour < 20) buckets.goldenHour += entry.durationListened;
    else buckets.velvetEvening += entry.durationListened;
  }

  const dominantBucket = (Object.entries(buckets) as Array<[keyof typeof buckets, number]>).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  let personaLabel = 'Night Owl';
  let personaRange = '23:00 – 03:00';
  let personaDescription =
    'Paling hidup saat kota mulai sunyi dan lagu menjadi teman berpikir paling jujur.';
  let auraTitle = 'Overthinking Romantis';
  let auraNarrative =
    'Kamu sering memutar ulang nada-nada yang terasa dekat dengan isi kepalamu di jam sunyi. Minggu ini hatimu lembut, penuh nostalgia, dan sangat peka pada setiap bait lirik.';
  let auraPalette: AmbientPalette = buildAmbientPalette(
    { r: 129, g: 140, b: 248, hex: '#818CF8' },
    { r: 244, g: 114, b: 182, hex: '#F472B6' },
    0.72
  );

  const maxTrackPlays = topTracks[0]?.playCount || 0;
  const isHeavyRepeater = maxTrackPlays >= 3 || (weekEntries.length > 0 && trackMap.size / weekEntries.length < 0.55);

  if (dominantBucket === 'nightOwl') {
    personaLabel = 'Night Owl';
    personaRange = '23:00 – 03:00';
    personaDescription =
      'Puncak fokus dan emosimu selalu muncul setelah tengah malam ketika dunia sudah terlelap.';
    if (isHeavyRepeater) {
      auraTitle = 'Overthinking Romantis';
      auraNarrative =
        'Satu lagu favorit diputar berulang-ulang di jam sunyi, seolah menyimpan cerita yang belum sempat terucap. Minggu ini kamu merayakan perasaanmu dengan tenang di balik headset.';
      auraPalette = buildAmbientPalette(
        { r: 139, g: 92, b: 246, hex: '#8B5CF6' },
        { r: 236, g: 72, b: 153, hex: '#EC4899' },
        0.74
      );
    } else {
      auraTitle = 'Midnight Main Character';
      auraNarrative =
        'Menyusuri larut malam dengan soundtrack sinematik yang mengalir tanpa henti. Setiap pergantian lagu minggu ini terasa seperti adegan film pribadimu.';
      auraPalette = buildAmbientPalette(
        { r: 99, g: 102, b: 241, hex: '#6366F1' },
        { r: 56, g: 189, b: 248, hex: '#38BDF8' },
        0.7
      );
    }
  } else if (dominantBucket === 'goldenHour') {
    personaLabel = 'Golden Hour Melancholic';
    personaRange = '16:00 – 19:00';
    personaDescription =
      'Menikmati pergantian sore sambil menyelami melodi hangat dan lirik-lirik yang reflektif.';
    auraTitle = 'Soft Hearted Dreamer';
    auraNarrative =
      'Selalu menemukan ruang tenang di antara warna senja dan musik yang menyentuh hati. Minggu ini energimu lembut, puitis, dan penuh rasa syukur.';
    auraPalette = buildAmbientPalette(
      { r: 251, g: 146, b: 60, hex: '#FB923C' },
      { r: 244, g: 63, b: 94, hex: '#F43F5E' },
      0.76
    );
  } else if (dominantBucket === 'morning') {
    personaLabel = 'Morning Hustler';
    personaRange = '06:00 – 10:00';
    personaDescription =
      'Mengawali pagi dengan ritme tajam dan kurasi lagu yang langsung menyalakan semangat.';
    auraTitle = 'Main Character Energy';
    auraNarrative =
      'Langkahmu minggu ini terasa ringan dan terarah dengan deretan lagu pembangkit mood sejak pagi. Kamu tahu persis bagaimana menyetel frekuensi terbaik untuk dirimu sendiri.';
    auraPalette = buildAmbientPalette(
      { r: 52, g: 211, b: 153, hex: '#34D399' },
      { r: 59, g: 130, b: 246, hex: '#3B82F6' },
      0.72
    );
  } else if (dominantBucket === 'midday') {
    personaLabel = 'Daylight Voyager';
    personaRange = '11:00 – 15:00';
    personaDescription =
      'Menjadikan musik sebagai bahan bakar fokus dan penyeimbang ritme di tengah aktivitas siang.';
    auraTitle = 'Main Character Energy';
    auraNarrative =
      'Penuh eksplorasi melodi baru dan menjaga momentum tetap stabil sepanjang minggu. Kurasi musikmu menunjukkan pikiran yang terbuka dan selera yang segar.';
    auraPalette = buildAmbientPalette(
      { r: 56, g: 189, b: 248, hex: '#38BDF8' },
      { r: 168, g: 85, b: 247, hex: '#A855F7' },
      0.74
    );
  } else {
    personaLabel = 'Velvet Evening Listener';
    personaRange = '20:00 – 22:59';
    personaDescription =
      'Menutup malam dengan alunan intim sebelum beristirahat, meresapi setiap nada tanpa terburu-buru.';
    auraTitle = 'Soft Hearted Dreamer';
    auraNarrative =
      'Hangat, intim, dan penuh perhatian terhadap detail setiap aransemen lagu. Minggu ini musik menjadi tempat pulang paling nyaman untukmu.';
    auraPalette = buildAmbientPalette(
      { r: 192, g: 132, b: 252, hex: '#C084FC' },
      { r: 251, g: 113, b: 133, hex: '#FB7185' },
      0.72
    );
  }

  const personaUnified =
    dominantBucket === 'nightOwl'
      ? '1f319'
      : dominantBucket === 'goldenHour'
        ? '2728'
        : dominantBucket === 'morning'
          ? '1f525'
          : '1f3a7';

  return {
    hasEnoughData: trackMap.size >= 3 || weekEntries.length >= 3,
    uniqueTrackCount: trackMap.size,
    totalPlays: weekEntries.length,
    totalSeconds,
    totalHours,
    remainingMinutes,
    formattedTotalTime,
    personaLabel,
    personaRange,
    personaDescription,
    personaUnified,
    auraTitle,
    auraNarrative,
    auraPalette,
    topTracks,
    topArtists,
  };
}

export function generateSimulatedWeeklyHistory(seedTracks: Track[]): ListeningHistoryEntry[] {
  const pool = (seedTracks.length >= 5 ? seedTracks : EMERGENCY_FALLBACK_TRACKS).slice(0, 8);
  const now = Date.now();
  const entries: ListeningHistoryEntry[] = [];

  // Weighted plays across past 6 days favoring late-night / evening hours for relatable Nocty vibe
  const pattern: Array<{ trackIdx: number; daysAgo: number; hour: number; duration: number }> = [
    { trackIdx: 0, daysAgo: 0, hour: 23, duration: 245 },
    { trackIdx: 0, daysAgo: 1, hour: 0, duration: 232 },
    { trackIdx: 0, daysAgo: 2, hour: 23, duration: 218 },
    { trackIdx: 0, daysAgo: 4, hour: 1, duration: 240 },
    { trackIdx: 1, daysAgo: 0, hour: 18, duration: 215 },
    { trackIdx: 1, daysAgo: 2, hour: 22, duration: 228 },
    { trackIdx: 1, daysAgo: 5, hour: 23, duration: 205 },
    { trackIdx: 2, daysAgo: 1, hour: 23, duration: 198 },
    { trackIdx: 2, daysAgo: 3, hour: 0, duration: 210 },
    { trackIdx: 3, daysAgo: 2, hour: 17, duration: 192 },
    { trackIdx: 4, daysAgo: 3, hour: 21, duration: 224 },
    { trackIdx: 5 % pool.length, daysAgo: 4, hour: 23, duration: 188 },
    { trackIdx: 6 % pool.length, daysAgo: 5, hour: 18, duration: 204 },
    { trackIdx: 7 % pool.length, daysAgo: 6, hour: 0, duration: 216 },
  ];

  for (const item of pattern) {
    const t = pool[item.trackIdx % pool.length];
    if (!t) continue;
    const d = new Date(now - item.daysAgo * 24 * 60 * 60 * 1000);
    d.setHours(item.hour, Math.floor(Math.random() * 50), 0, 0);
    // Ensure timestamp is not in the future
    const ts = Math.min(now - 60_000, d.getTime());
    entries.push({
      trackId: t.id,
      title: t.title,
      artist: t.artist,
      artwork: t.coverUrl,
      durationListened: item.duration,
      timestamp: ts,
    });
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}
