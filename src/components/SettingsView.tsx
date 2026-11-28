import React, { useEffect, useState } from 'react';
import {
  AudioLines,
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Film,
  HeartHandshake,
  Image as ImageIcon,
  Info,
  ListMusic,
  Monitor,
  Moon,
  Palette,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Vibrate,
  Wifi,
} from 'lucide-react';
import { useNetworkMode } from '../context/NetworkModeContext';
import { usePlayer } from '../context/PlayerContext';
import { BrowserPermissionState, useSettings } from '../context/SettingsContext';
import { IosLiquidGlassSwitch } from './IosLiquidGlassSwitch';

type SquircleTone = 'blue' | 'purple' | 'green' | 'orange' | 'rose' | 'teal' | 'slate';

const SQUIRCLE_TONE_CLASSES: Record<SquircleTone, string> = {
  blue: 'bg-sky-500/25 border-sky-300/35 text-sky-200',
  purple: 'bg-violet-500/25 border-violet-300/35 text-violet-200',
  green: 'bg-emerald-500/25 border-emerald-300/35 text-emerald-200',
  orange: 'bg-amber-500/25 border-amber-300/35 text-amber-200',
  rose: 'bg-rose-500/25 border-rose-300/35 text-rose-200',
  teal: 'bg-teal-500/25 border-teal-300/35 text-teal-200',
  slate: 'bg-white/15 border-white/25 text-white/90',
};

const IosSquircleIcon: React.FC<{ tone: SquircleTone; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <span
    className={`w-8 h-8 rounded-[10px] border flex items-center justify-center shrink-0 backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28)] ${SQUIRCLE_TONE_CLASSES[tone]}`}
  >
    {children}
  </span>
);

const PermissionGlassBadge: React.FC<{ state: BrowserPermissionState | 'active' }> = ({ state }) => {
  const isGranted = state === 'granted' || state === 'active';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-md whitespace-nowrap ${
        isGranted
          ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-200'
          : 'bg-amber-400/20 border-amber-300/40 text-amber-200'
      }`}
    >
      {isGranted ? 'Diizinkan' : 'Perlu Izin Sistem'}
    </span>
  );
};

export const SettingsView: React.FC = () => {
  const {
    settings,
    permissions,
    formattedCacheSize,
    cacheSizeBytes,
    isClearingCache,
    syncBrowserPermissions,
    refreshCacheEstimate,
    toggleMediaNotifications,
    toggleBackgroundPlayback,
    toggleGalleryStorage,
    toggleCameraScanner,
    toggleHapticFeedback,
    toggleAdaptiveNetwork,
    toggleDynamicIsland,
    toggleTwinNotifications,
    toggleSlipAutoVibe,
    openSystemSettings,
    openOverlayPermissionSettings,
    clearAppCache,
  } = useSettings();

  const { mode: networkMode, acceptNormalMode } = useNetworkMode();
  const {
    setActiveView,
    isAutoplayEnabled,
    toggleAutoplay,
    isAmbientVideoEnabled,
    toggleAmbientVideo,
    isInstallable,
    promptInstallApp,
    themeMode,
    cycleThemeMode,
    isDynamicThemeSync,
    toggleDynamicThemeSync,
    ambientPalette,
    pushToast,
  } = usePlayer();

  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  // Sync browser permissions & cache footprint automatically every time Settings is opened
  useEffect(() => {
    syncBrowserPermissions();
    refreshCacheEstimate();
  }, [syncBrowserPermissions, refreshCacheEstimate]);

  const { primary, secondary } = ambientPalette;

  const handleOpenSystemSettings = async () => {
    const result = await openSystemSettings();
    if (result === 'web-fallback') {
      pushToast(
        'Ketuk ikon gembok/setelan di bilah alamat browser untuk mengizinkan akses.',
        'info'
      );
    }
  };

  const handleOpenOverlaySettings = async () => {
    const result = await openOverlayPermissionSettings();
    if (result === 'web-fallback') {
      pushToast('Izin Overlay mengambang tersedia di aplikasi Android Nocty.', 'info');
    }
  };

  const handleToggleNotif = async () => {
    const res = await toggleMediaNotifications();
    if (res.permission === 'denied') {
      pushToast('Izin notifikasi ditolak — ketuk "Buka Pengaturan Sistem" di kartu ini.', 'info');
    } else if (res.permission === 'unsupported') {
      pushToast('Notifikasi web tidak didukung di peramban ini.', 'info');
    } else if (res.permission === 'granted') {
      pushToast('Notifikasi & Kontrol Layar Kunci diaktifkan', 'success');
    }
  };

  const handleToggleCamera = async () => {
    const res = await toggleCameraScanner();
    if (res.permission === 'denied') {
      pushToast('Izin kamera ditolak — ketuk "Buka Pengaturan Sistem" untuk mengaktifkan.', 'info');
    } else if (res.permission === 'unsupported') {
      pushToast('Akses kamera tidak tersedia pada perangkat/peramban ini.', 'info');
    } else if (res.permission === 'granted') {
      pushToast('Izin Kamera & Pemindai diaktifkan', 'success');
    }
  };

  const handleToggleAdaptive = () => {
    const next = !settings.adaptiveNetworkEnabled;
    toggleAdaptiveNetwork();
    if (!next && networkMode === 'lite') {
      acceptNormalMode();
    }
    pushToast(
      next
        ? 'Adaptive Smart Network Mode aktif'
        : 'Adaptive Smart Network Mode dimatikan (Mode Normal)',
      'info'
    );
  };

  const handleClearCache = async () => {
    const clearedBytes = await clearAppCache();
    pushToast(
      clearedBytes > 0
        ? `Cache dibersihkan (${formattedCacheSize} dibebaskan)`
        : 'Cache sementara sudah bersih',
      'success'
    );
  };

  const handleInstallPwa = async () => {
    if (isInstallable) {
      await promptInstallApp();
      return;
    }
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      pushToast('Nocty sudah terpasang di layar utama perangkatmu', 'success');
    } else {
      pushToast('Buka menu Bagikan (Safari) atau Menu ⋮ (Chrome) lalu pilih "Tambah ke Layar Utama"', 'info');
    }
  };

  const themeDisplayText =
    themeMode === 'system' ? 'Otomatis' : themeMode === 'light' ? 'Terang' : 'Gelap';

  return (
    <div className="relative max-w-3xl mx-auto pb-44 lg:pb-12 space-y-7">
      {/* Ambient Liquid Glass Depth Glow behind Settings Cards */}
      <div
        aria-hidden="true"
        className="ambient-aura-layer pointer-events-none absolute -top-12 inset-x-0 h-80 blur-3xl opacity-35"
        style={{
          background: `
            radial-gradient(circle at 18% 25%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85) 0%, transparent 62%),
            radial-gradient(circle at 82% 65%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.78) 0%, transparent 62%)
          `,
        }}
      />

      {/* iOS Settings Header */}
      <div className="relative z-10 flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveView('home')}
            aria-label="Kembali ke Beranda"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex items-center justify-center text-white/85 hover:text-white transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Pengaturan
            </h1>
            <p className="text-xs sm:text-sm text-white/55 truncate">
              Izin sistem, pemutar cerdas, dan preferensi Nocty
            </p>
          </div>
        </div>
      </div>

      {/* A. IZIN SISTEM & AKSESIBILITAS */}
      <section className="relative z-10">
        <h2 className="px-2 mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
          Izin Sistem &amp; Aksesibilitas
        </h2>
        <div className="space-y-2.5">
          {/* 1. Notifikasi & Kontrol Media */}
          <div className="rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <IosSquircleIcon tone="blue">
                  <Bell className="w-4 h-4" strokeWidth={2} />
                </IosSquircleIcon>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      Notifikasi &amp; Kontrol Layar Kunci
                    </p>
                    <PermissionGlassBadge state={permissions.notifications} />
                  </div>
                  <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                    Tampilkan kontrol lagu, sampul album &amp; judul di panel notifikasi serta layar kunci HP.
                  </p>
                </div>
              </div>
              <IosLiquidGlassSwitch
                checked={settings.mediaNotificationsEnabled && permissions.notifications === 'granted'}
                onToggle={handleToggleNotif}
                label="Notifikasi & Kontrol Layar Kunci"
              />
            </div>

            {permissions.notifications === 'denied' && (
              <div className="pl-[46px] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenSystemSettings}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.10] hover:bg-white/[0.16] border border-white/[0.15] text-[11px] font-medium text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  <span>Buka Pengaturan Sistem</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Pemutaran Latar Belakang & Layar Kunci */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="purple">
                <Smartphone className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    Pemutaran Latar Belakang &amp; Layar Kunci
                  </p>
                  <PermissionGlassBadge
                    state={settings.backgroundPlaybackEnabled ? 'active' : 'prompt'}
                  />
                </div>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Jaga audio tetap berjalan saat layar mati via WakeLock &amp; MediaSession API.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={settings.backgroundPlaybackEnabled}
              onToggle={toggleBackgroundPlayback}
              label="Pemutaran Latar Belakang & Layar Kunci"
            />
          </div>

          {/* 3. Izin Galeri & Penyimpanan */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="green">
                <ImageIcon className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    Izin Galeri &amp; Penyimpanan
                  </p>
                  <PermissionGlassBadge
                    state={
                      settings.galleryStorageEnabled || permissions.storagePersisted
                        ? 'granted'
                        : 'prompt'
                    }
                  />
                </div>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Simpan hasil cetak 9:16 (Slip Nocty &amp; Nocturnal Aura) &amp; pilih foto kustom.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={settings.galleryStorageEnabled}
              onToggle={toggleGalleryStorage}
              label="Izin Galeri & Penyimpanan"
            />
          </div>

          {/* 4. Izin Kamera & Pemindai */}
          <div className="rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <IosSquircleIcon tone="orange">
                  <Camera className="w-4 h-4" strokeWidth={2} />
                </IosSquircleIcon>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      Izin Kamera &amp; Pemindai
                    </p>
                    <PermissionGlassBadge state={permissions.camera} />
                  </div>
                  <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                    Untuk memindai barcode batang Slip Nocty teman secara langsung.
                  </p>
                </div>
              </div>
              <IosLiquidGlassSwitch
                checked={settings.cameraScannerEnabled && permissions.camera === 'granted'}
                onToggle={handleToggleCamera}
                label="Izin Kamera & Pemindai"
              />
            </div>

            {permissions.camera === 'denied' && (
              <div className="pl-[46px] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenSystemSettings}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.10] hover:bg-white/[0.16] border border-white/[0.15] text-[11px] font-medium text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  <span>Buka Pengaturan Sistem</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Haptic Feedback */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="teal">
                <Vibrate className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Haptic Feedback
                </p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Aktifkan getaran mikro saat interaksi UI
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={settings.hapticFeedbackEnabled}
              onToggle={toggleHapticFeedback}
              disableAutoHaptic={true}
              label="Haptic Feedback"
            />
          </div>
        </div>
      </section>

      {/* B. PEMUTAR & JARINGAN PINTAR */}
      <section className="relative z-10">
        <h2 className="px-2 mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
          Pemutar &amp; Jaringan Pintar
        </h2>
        <div className="space-y-2.5">
          {/* Adaptive Smart Network Mode */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="teal">
                <Wifi className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Adaptive Smart Network Mode
                </p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Deteksi sinyal lemah &amp; tawarkan Mode Ringan hemat kuota tanpa sembunyikan Dynamic Island.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={settings.adaptiveNetworkEnabled}
              onToggle={handleToggleAdaptive}
              label="Adaptive Smart Network Mode"
            />
          </div>

          {/* Auto-Play Lagu Berikutnya */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="green">
                <ListMusic className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Auto-Play Lagu Berikutnya
                </p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Lanjut memutar rekomendasi atau antrean otomatis ketika lagu berakhir.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={isAutoplayEnabled}
              onToggle={toggleAutoplay}
              label="Auto-Play Lagu Berikutnya"
            />
          </div>

          {/* Mode Video / MV Background */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="purple">
                <Film className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Mode Video / MV Background
                </p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Putar Official Music Video secara diam-diam di latar belakang pemutar (nonaktif saat hemat kuota).
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={isAmbientVideoEnabled}
              onToggle={toggleAmbientVideo}
              label="Mode Video / MV Background"
            />
          </div>

          {/* Dynamic Island Pill & Overlay */}
          <div className="rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <IosSquircleIcon tone="purple">
                  <AudioLines className="w-4 h-4" strokeWidth={2} />
                </IosSquircleIcon>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">Dynamic Island Pill</p>
                    {permissions.isNativeAndroid && (
                      <PermissionGlassBadge state={permissions.overlay} />
                    )}
                  </div>
                  <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                    Tampilkan kapsul interaktif Dynamic Island di bagian atas layar &amp; overlay Android.
                  </p>
                </div>
              </div>
              <IosLiquidGlassSwitch
                checked={settings.dynamicIslandEnabled}
                onToggle={toggleDynamicIsland}
                label="Dynamic Island Pill"
              />
            </div>

            {permissions.isNativeAndroid && permissions.overlay !== 'granted' && settings.dynamicIslandEnabled && (
              <div className="pl-[46px] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenOverlaySettings}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.10] hover:bg-white/[0.16] border border-white/[0.15] text-[11px] font-medium text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3" strokeWidth={2} />
                  <span>Buka Pengaturan Overlay Sistem</span>
                </button>
              </div>
            )}
          </div>

          {/* Tema Antarmuka */}
          <button
            type="button"
            onClick={cycleThemeMode}
            className="w-full flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] hover:bg-white/[0.10] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] text-left transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="blue">
                {themeMode === 'system' ? (
                  <Monitor className="w-4 h-4" strokeWidth={2} />
                ) : themeMode === 'light' ? (
                  <Sun className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <Moon className="w-4 h-4" strokeWidth={2} />
                )}
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Tema Tampilan</p>
                <p className="text-xs text-white/55 mt-0.5">
                  Ketuk untuk ganti antara Otomatis Sistem, Terang, atau Gelap
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/70 shrink-0">
              <span>{themeDisplayText}</span>
              <ChevronRight className="w-4 h-4 text-white/45" />
            </div>
          </button>

          {/* Sinkron Warna Album */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="rose">
                <Palette className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Sinkron Warna Album</p>
                <p className="text-xs text-white/55 mt-0.5">
                  Sesuaikan pendaran ambient &amp; aksen dengan sampul lagu aktif.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={isDynamicThemeSync}
              onToggle={toggleDynamicThemeSync}
              label="Sinkron Warna Album"
            />
          </div>
        </div>
      </section>

      {/* C. SOSIAL & STUDIO */}
      <section className="relative z-10">
        <h2 className="px-2 mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
          Sosial &amp; Studio
        </h2>
        <div className="space-y-2.5">
          {/* Notifikasi Nocty Twin & Tap Heart */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="rose">
                <HeartHandshake className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Notifikasi Nocty Twin &amp; Tap Heart
                </p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Terima getaran &amp; notifikasi saat teman mengajak dengar bareng atau kirim detak jantung.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={settings.twinNotificationsEnabled}
              onToggle={toggleTwinNotifications}
              label="Notifikasi Nocty Twin & Tap Heart"
            />
          </div>

          {/* Auto-Vibe Slip Nocty */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="purple">
                <Sparkles className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Auto-Vibe Slip Nocty</p>
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                  Otomatis pilihkan template Slip Nocty sesuai genre dan mood lagu yang diputar.
                </p>
              </div>
            </div>
            <IosLiquidGlassSwitch
              checked={settings.slipAutoVibeEnabled}
              onToggle={toggleSlipAutoVibe}
              label="Auto-Vibe Slip Nocty"
            />
          </div>
        </div>
      </section>

      {/* D. PENYIMPANAN & INFO APLIKASI */}
      <section className="relative z-10">
        <h2 className="px-2 mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/50">
          Penyimpanan &amp; Info Aplikasi
        </h2>
        <div className="space-y-2.5">
          {/* Bersihkan Cache Audio & Gambar */}
          <button
            type="button"
            disabled={isClearingCache}
            onClick={handleClearCache}
            className="w-full flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.12] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] text-left disabled:opacity-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="orange">
                <Trash2 className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Bersihkan Cache Audio &amp; Gambar
                </p>
                <p className="text-xs text-white/55 mt-0.5">
                  Hapus cache pencarian, lirik &amp; stream sementara (playlist &amp; MP3 aman).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono-tabular px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 border border-white/[0.14] text-white/85">
                {cacheSizeBytes > 0 ? formattedCacheSize : '0 KB'}
              </span>
              <ChevronRight className="w-4 h-4 text-white/45" />
            </div>
          </button>

          {/* Instal ke Layar Utama (PWA) */}
          <button
            type="button"
            onClick={handleInstallPwa}
            className="w-full flex items-center justify-between gap-3 rounded-3xl bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.12] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] px-4 py-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] text-left transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <IosSquircleIcon tone="blue">
                <Download className="w-4 h-4" strokeWidth={2} />
              </IosSquircleIcon>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Instal ke Layar Utama (PWA)
                </p>
                <p className="text-xs text-white/55 mt-0.5">
                  Pintasan instalasi cepat dari Safari atau Chrome HP.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-white/70 shrink-0">
              <span>{isInstallable ? 'Pasang' : 'Panduan'}</span>
              <ChevronRight className="w-4 h-4 text-white/45" />
            </div>
          </button>

          {/* Tentang Nocty */}
          <div className="rounded-3xl bg-white/[0.06] backdrop-blur-3xl backdrop-saturate-150 border border-white/[0.18] shadow-[inset_0_1px_1px_rgba(255,255,255,0.32),0_12px_32px_rgba(0,0,0,0.45)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAboutExpanded((v) => !v)}
              aria-expanded={isAboutExpanded}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <IosSquircleIcon tone="slate">
                  <Info className="w-4 h-4" strokeWidth={2} />
                </IosSquircleIcon>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Tentang Nocty</p>
                  <p className="text-xs text-white/55 mt-0.5">
                    Informasi versi &amp; pengembang aplikasi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono-tabular text-xs font-semibold text-white/75">
                  v1.0.0
                </span>
                <ChevronRight
                  className={`w-4 h-4 text-white/45 transition-transform duration-200 ${
                    isAboutExpanded ? 'rotate-90' : ''
                  }`}
                />
              </div>
            </button>

            {isAboutExpanded && (
              <div className="px-4 pb-4 pt-1 pl-[62px] text-xs text-white/65 space-y-1.5 border-t border-white/[0.06]">
                <p>
                  <strong className="text-white/90">Nocty Audio Studio</strong> · Versi{' '}
                  <span className="font-mono-tabular text-white/85">v1.0.0</span>
                </p>
                <p className="leading-relaxed">
                  Pemutar musik imersif lintas web dan Android dengan streaming penuh, lirik sinkron,
                  Slip Nocty 9:16, dan Nocty Twin.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
