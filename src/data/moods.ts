import { MoodCategory, Track } from '../types/music';

export const DEFAULT_COVER_URL = '/src/assets/images/purebeat_default_cover_1795653178048.jpg';

export const MOOD_CATEGORIES: MoodCategory[] = [
  {
    id: 'fokus',
    label: 'Fokus',
    subtitle: 'Instrumental tenang & lo-fi presisi',
    query: 'lofi beats chill focus instrumental music',
    coverUrl: '/src/assets/images/mood_fokus_1795653177714.jpg',
    accentHex: '#10B981',
  },
  {
    id: 'santai',
    label: 'Santai',
    subtitle: 'Akustik hangat & indie Indonesia',
    query: 'indie indonesia akustik santai tulus hindia',
    coverUrl: '/src/assets/images/mood_santai_1795653177933.jpg',
    accentHex: '#84CC16',
  },
  {
    id: 'larut-malam',
    label: 'Larut Malam',
    subtitle: 'R&B atmosferik & balada malam',
    query: 'late night rnb chill synthwave slow',
    coverUrl: '/src/assets/images/mood_larut_malam_1795653179087.jpg',
    accentHex: '#A3E635',
  },
  {
    id: 'energi',
    label: 'Energi',
    subtitle: 'Upbeat pop & ritme bertenaga',
    query: 'upbeat pop dance hits workout energy',
    coverUrl: '/src/assets/images/mood_energi_1795653179611.jpg',
    accentHex: '#22C55E',
  },
];

/**
 * Curated offline-resilient royalty-free fallback tracks used only when all
 * external Piped/iTunes network requests fail in a restricted environment.
 */
export const EMERGENCY_FALLBACK_TRACKS: Track[] = [
  {
    id: 'fallback-1',
    title: 'Neon Horizon',
    artist: 'Studio Nocty',
    album: 'Ambient Sessions',
    duration: 372,
    coverUrl: '/src/assets/images/mood_fokus_1795653177714.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    sourceType: 'online',
    lyrics: [
      { time: 2, text: 'Cahaya hijau berpendar di ruang sunyi' },
      { time: 9, text: 'Menyusuri nada dalam frekuensi tenang' },
      { time: 17, text: 'Setiap ketukan menjaga fokus tetap utuh' },
      { time: 26, text: 'Mengalir pelan menuju cakrawala malam' },
    ],
    lyricsStatus: 'loaded',
    createdAt: 1700000001000,
  },
  {
    id: 'fallback-2',
    title: 'Emerald Mist',
    artist: 'Kinetik Harmoni',
    album: 'Nocturne Wave',
    duration: 425,
    coverUrl: '/src/assets/images/mood_santai_1795653177933.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    sourceType: 'online',
    lyrics: [
      { time: 3, text: 'Kabut lembut turun di penghujung senja' },
      { time: 11, text: 'Berhenti sejenak dari riuhnya kota' },
      { time: 20, text: 'Biarkan melodi membawa tenang ke dalam diri' },
    ],
    lyricsStatus: 'loaded',
    createdAt: 1700000002000,
  },
  {
    id: 'fallback-3',
    title: 'Midnight Pulse',
    artist: 'Luna Synth',
    album: 'Larut Malam Vol. 1',
    duration: 344,
    coverUrl: '/src/assets/images/mood_larut_malam_1795653179087.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    sourceType: 'online',
    lyrics: [
      { time: 2, text: 'Detik jarum jam melambat saat tengah malam' },
      { time: 10, text: 'Lampu jalan memantul di kaca jendela' },
      { time: 19, text: 'Irama hangat menemani perjalanan pulang' },
    ],
    lyricsStatus: 'loaded',
    createdAt: 1700000003000,
  },
  {
    id: 'fallback-4',
    title: 'Chartreuse Drive',
    artist: 'Veloce Collective',
    album: 'High Voltage',
    duration: 302,
    coverUrl: '/src/assets/images/mood_energi_1795653179611.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    sourceType: 'online',
    lyrics: [
      { time: 2, text: 'Langkah cepat menembus batas ragu' },
      { time: 9, text: 'Ritme menghentak membakar semangat baru' },
      { time: 17, text: 'Terus melaju hingga garis akhir tercapai' },
    ],
    lyricsStatus: 'loaded',
    createdAt: 1700000004000,
  },
];
