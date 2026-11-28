import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { setHapticFeedbackEnabledState, triggerHaptic } from '../utils/haptics';
import { setAdaptiveNetworkModeEnabledState } from '../utils/networkTelemetry';

const SETTINGS_STORAGE_KEY = 'nocty_app_settings_v1';

const TEMP_CACHE_KEYS = [
  'nocty_search_cache_v1',
  'nocty_curated_cache_v1',
  'nocty_stream_cache_v1',
  'nocty_lyrics_cache_v1',
];

export type BrowserPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface AppSettingsState {
  // A. Izin Sistem & Aksesibilitas
  mediaNotificationsEnabled: boolean;
  backgroundPlaybackEnabled: boolean;
  galleryStorageEnabled: boolean;
  cameraScannerEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  // B. Pemutar & Jaringan Pintar
  adaptiveNetworkEnabled: boolean;
  dynamicIslandEnabled: boolean;
  // C. Sosial & Studio
  twinNotificationsEnabled: boolean;
  slipAutoVibeEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettingsState = {
  mediaNotificationsEnabled: false,
  backgroundPlaybackEnabled: true,
  galleryStorageEnabled: true,
  cameraScannerEnabled: false,
  hapticFeedbackEnabled: true,
  adaptiveNetworkEnabled: true,
  dynamicIslandEnabled: true,
  twinNotificationsEnabled: true,
  slipAutoVibeEnabled: true,
};

function loadSavedSettings(): AppSettingsState {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettingsState>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(next: AppSettingsState): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / private mode restriction
  }
}

export interface BrowserPermissionsStatus {
  notifications: BrowserPermissionState;
  camera: BrowserPermissionState;
  overlay: BrowserPermissionState;
  storagePersisted: boolean;
  wakeLockSupported: boolean;
  isNativeAndroid: boolean;
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

interface SettingsContextValue {
  settings: AppSettingsState;
  permissions: BrowserPermissionsStatus;
  cacheSizeBytes: number;
  formattedCacheSize: string;
  isClearingCache: boolean;
  syncBrowserPermissions: () => Promise<void>;
  refreshCacheEstimate: () => Promise<void>;
  toggleMediaNotifications: () => Promise<{ permission: BrowserPermissionState }>;
  toggleBackgroundPlayback: () => void;
  toggleGalleryStorage: () => Promise<void>;
  toggleCameraScanner: () => Promise<{ permission: BrowserPermissionState }>;
  toggleHapticFeedback: () => void;
  toggleAdaptiveNetwork: () => void;
  toggleDynamicIsland: () => Promise<void>;
  toggleTwinNotifications: () => void;
  toggleSlipAutoVibe: () => void;
  openSystemSettings: () => Promise<'opened' | 'web-fallback'>;
  openOverlayPermissionSettings: () => Promise<'opened' | 'web-fallback'>;
  clearAppCache: () => Promise<number>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettingsState>(() => {
    const initial = loadSavedSettings();
    setAdaptiveNetworkModeEnabledState(initial.adaptiveNetworkEnabled);
    setHapticFeedbackEnabledState(initial.hapticFeedbackEnabled);
    return initial;
  });

  const [permissions, setPermissions] = useState<BrowserPermissionsStatus>(() => ({
    notifications:
      typeof Notification !== 'undefined'
        ? (Notification.permission === 'default'
            ? 'prompt'
            : Notification.permission) as BrowserPermissionState
        : 'unsupported',
    camera: 'prompt',
    overlay: 'granted',
    storagePersisted: false,
    wakeLockSupported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
    isNativeAndroid: Boolean(window.Capacitor?.isNativePlatform?.()),
  }));

  const [cacheSizeBytes, setCacheSizeBytes] = useState<number>(0);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const updateSettings = useCallback(
    (updater: (prev: AppSettingsState) => AppSettingsState) => {
      setSettings((prev) => {
        const next = updater(prev);
        saveSettings(next);
        setAdaptiveNetworkModeEnabledState(next.adaptiveNetworkEnabled);
        setHapticFeedbackEnabledState(next.hapticFeedbackEnabled);
        return next;
      });
    },
    []
  );

  const syncBrowserPermissions = useCallback(async () => {
    const isNativeAndroid = Boolean(window.Capacitor?.isNativePlatform?.());
    const islandPlugin = window.Capacitor?.Plugins?.DynamicIsland;

    let notifState: BrowserPermissionState = 'unsupported';
    if (typeof Notification !== 'undefined') {
      notifState = (
        Notification.permission === 'default' ? 'prompt' : Notification.permission
      ) as BrowserPermissionState;
    }

    let cameraState: BrowserPermissionState =
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
        ? 'prompt'
        : 'unsupported';

    let overlayState: BrowserPermissionState = 'granted';

    if (isNativeAndroid && islandPlugin?.checkSystemPermissions) {
      try {
        const nativePerms = await islandPlugin.checkSystemPermissions();
        if (nativePerms?.notifications) notifState = nativePerms.notifications;
        if (nativePerms?.camera) cameraState = nativePerms.camera;
        if (nativePerms?.overlay) overlayState = nativePerms.overlay;
      } catch {
        // Fallback to Web Permissions API
      }
    } else if (isNativeAndroid && islandPlugin?.checkOverlayPermission) {
      try {
        const res = await islandPlugin.checkOverlayPermission();
        overlayState = res?.granted ? 'granted' : 'prompt';
      } catch {
        overlayState = 'prompt';
      }
    }

    if (!isNativeAndroid && typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const notifRes = await navigator.permissions.query({
          name: 'notifications' as PermissionName,
        });
        if (notifRes.state) {
          notifState = notifRes.state as BrowserPermissionState;
        }
      } catch {
        // Fallback to Notification.permission
      }

      try {
        const camRes = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (camRes.state) {
          cameraState = camRes.state as BrowserPermissionState;
        }
      } catch {
        // Safari/older browsers may not support camera in Permissions API
      }
    }

    let storagePersisted = false;
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      try {
        storagePersisted = await navigator.storage.persisted();
      } catch {
        storagePersisted = false;
      }
    }

    setPermissions({
      notifications: notifState,
      camera: cameraState,
      overlay: overlayState,
      storagePersisted,
      wakeLockSupported: typeof navigator !== 'undefined' && 'wakeLock' in navigator,
      isNativeAndroid,
    });

    // If system revoked notification or camera access, keep toggle state accurate
    setSettings((prev) => {
      let changed = false;
      const next = { ...prev };
      if (notifState === 'denied' && prev.mediaNotificationsEnabled) {
        next.mediaNotificationsEnabled = false;
        changed = true;
      }
      if (cameraState === 'denied' && prev.cameraScannerEnabled) {
        next.cameraScannerEnabled = false;
        changed = true;
      }
      if (changed) saveSettings(next);
      return changed ? next : prev;
    });
  }, []);

  const refreshCacheEstimate = useCallback(async () => {
    let totalBytes = 0;

    try {
      for (const key of TEMP_CACHE_KEYS) {
        const val = localStorage.getItem(key);
        if (val) {
          totalBytes += val.length * 2;
        }
      }
    } catch {
      // Ignore storage access errors
    }

    if (typeof caches !== 'undefined') {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const reqs = await cache.keys();
          totalBytes += reqs.length * 24 * 1024;
        }
      } catch {
        // Ignore CacheStorage error
      }
    }

    setCacheSizeBytes(totalBytes);
  }, []);

  useEffect(() => {
    syncBrowserPermissions();
    refreshCacheEstimate();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        syncBrowserPermissions();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncBrowserPermissions, refreshCacheEstimate]);

  // Keep adaptive telemetry & haptic flags synced with settings
  useEffect(() => {
    setAdaptiveNetworkModeEnabledState(settings.adaptiveNetworkEnabled);
    setHapticFeedbackEnabledState(settings.hapticFeedbackEnabled);
  }, [settings.adaptiveNetworkEnabled, settings.hapticFeedbackEnabled]);

  const toggleMediaNotifications = useCallback(async () => {
    const turningOn = !settings.mediaNotificationsEnabled;
    if (!turningOn) {
      updateSettings((prev) => ({ ...prev, mediaNotificationsEnabled: false }));
      return { permission: permissions.notifications };
    }

    const isNativeAndroid = Boolean(window.Capacitor?.isNativePlatform?.());
    const islandPlugin = window.Capacitor?.Plugins?.DynamicIsland;

    if (isNativeAndroid && islandPlugin?.requestNotificationPermission) {
      try {
        const res = await islandPlugin.requestNotificationPermission();
        const state: BrowserPermissionState =
          res?.state === 'granted' ? 'granted' : 'denied';
        updateSettings((prev) => ({ ...prev, mediaNotificationsEnabled: state === 'granted' }));
        await syncBrowserPermissions();
        return { permission: state };
      } catch {
        // Fallback to Web Notification API below
      }
    }

    if (typeof Notification === 'undefined') {
      updateSettings((prev) => ({ ...prev, mediaNotificationsEnabled: false }));
      await syncBrowserPermissions();
      return { permission: 'unsupported' as BrowserPermissionState };
    }

    let resultPermission: NotificationPermission = Notification.permission;
    if (resultPermission === 'default') {
      try {
        resultPermission = await Notification.requestPermission();
      } catch {
        resultPermission = Notification.permission;
      }
    }

    const mapped: BrowserPermissionState =
      resultPermission === 'default' ? 'prompt' : (resultPermission as BrowserPermissionState);
    const granted = resultPermission === 'granted';

    updateSettings((prev) => ({ ...prev, mediaNotificationsEnabled: granted }));
    await syncBrowserPermissions();
    return { permission: mapped };
  }, [permissions.notifications, settings.mediaNotificationsEnabled, syncBrowserPermissions, updateSettings]);

  const toggleBackgroundPlayback = useCallback(() => {
    updateSettings((prev) => ({
      ...prev,
      backgroundPlaybackEnabled: !prev.backgroundPlaybackEnabled,
    }));
  }, [updateSettings]);

  const toggleGalleryStorage = useCallback(async () => {
    const turningOn = !settings.galleryStorageEnabled;
    updateSettings((prev) => ({
      ...prev,
      galleryStorageEnabled: turningOn,
    }));

    if (turningOn && typeof navigator !== 'undefined' && navigator.storage?.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        // Optional persistence hint
      }
    }
    await syncBrowserPermissions();
  }, [settings.galleryStorageEnabled, syncBrowserPermissions, updateSettings]);

  const toggleCameraScanner = useCallback(async () => {
    const turningOn = !settings.cameraScannerEnabled;
    if (!turningOn) {
      updateSettings((prev) => ({ ...prev, cameraScannerEnabled: false }));
      return { permission: permissions.camera };
    }

    if (
      typeof navigator === 'undefined' ||
      typeof navigator.mediaDevices?.getUserMedia !== 'function'
    ) {
      updateSettings((prev) => ({ ...prev, cameraScannerEnabled: false }));
      await syncBrowserPermissions();
      return { permission: 'unsupported' as BrowserPermissionState };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      updateSettings((prev) => ({ ...prev, cameraScannerEnabled: true }));
      await syncBrowserPermissions();
      return { permission: 'granted' as BrowserPermissionState };
    } catch {
      updateSettings((prev) => ({ ...prev, cameraScannerEnabled: false }));
      await syncBrowserPermissions();
      return { permission: 'denied' as BrowserPermissionState };
    }
  }, [permissions.camera, settings.cameraScannerEnabled, syncBrowserPermissions, updateSettings]);

  const toggleHapticFeedback = useCallback(() => {
    const nextEnabled = !settings.hapticFeedbackEnabled;
    setHapticFeedbackEnabledState(nextEnabled);
    updateSettings((prev) => ({
      ...prev,
      hapticFeedbackEnabled: nextEnabled,
    }));
    if (nextEnabled) {
      triggerHaptic(12);
    }
  }, [settings.hapticFeedbackEnabled, updateSettings]);

  const toggleAdaptiveNetwork = useCallback(() => {
    updateSettings((prev) => ({
      ...prev,
      adaptiveNetworkEnabled: !prev.adaptiveNetworkEnabled,
    }));
  }, [updateSettings]);

  const toggleDynamicIsland = useCallback(async () => {
    const turningOn = !settings.dynamicIslandEnabled;
    updateSettings((prev) => ({
      ...prev,
      dynamicIslandEnabled: turningOn,
    }));

    const cap = window.Capacitor;
    const islandPlugin = cap?.Plugins?.DynamicIsland;
    if (turningOn && cap?.isNativePlatform?.() && islandPlugin) {
      try {
        const res = await islandPlugin.checkOverlayPermission?.();
        if (res && !res.granted) {
          await islandPlugin.requestOverlayPermission?.();
        }
      } catch {
        // Ignore overlay check error
      }
      await syncBrowserPermissions();
    }
  }, [settings.dynamicIslandEnabled, syncBrowserPermissions, updateSettings]);

  const toggleTwinNotifications = useCallback(() => {
    updateSettings((prev) => ({
      ...prev,
      twinNotificationsEnabled: !prev.twinNotificationsEnabled,
    }));
  }, [updateSettings]);

  const toggleSlipAutoVibe = useCallback(() => {
    updateSettings((prev) => ({
      ...prev,
      slipAutoVibeEnabled: !prev.slipAutoVibeEnabled,
    }));
  }, [updateSettings]);

  const openSystemSettings = useCallback(async (): Promise<'opened' | 'web-fallback'> => {
    const cap = window.Capacitor;
    const islandPlugin = cap?.Plugins?.DynamicIsland;
    if (cap?.isNativePlatform?.() && islandPlugin?.openAppSettings) {
      try {
        await islandPlugin.openAppSettings();
        return 'opened';
      } catch {
        // Fall through
      }
    }
    return 'web-fallback';
  }, []);

  const openOverlayPermissionSettings = useCallback(async (): Promise<'opened' | 'web-fallback'> => {
    const cap = window.Capacitor;
    const islandPlugin = cap?.Plugins?.DynamicIsland;
    if (cap?.isNativePlatform?.() && islandPlugin?.requestOverlayPermission) {
      try {
        await islandPlugin.requestOverlayPermission();
        return 'opened';
      } catch {
        // Fall through
      }
    }
    return 'web-fallback';
  }, []);

  const clearAppCache = useCallback(async (): Promise<number> => {
    setIsClearingCache(true);
    const prevBytes = cacheSizeBytes;
    try {
      for (const key of TEMP_CACHE_KEYS) {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }

      if (typeof caches !== 'undefined') {
        try {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        } catch {
          // ignore
        }
      }
      await refreshCacheEstimate();
      return prevBytes;
    } finally {
      setIsClearingCache(false);
    }
  }, [cacheSizeBytes, refreshCacheEstimate]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      permissions,
      cacheSizeBytes,
      formattedCacheSize: formatBytesCompact(cacheSizeBytes),
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
    }),
    [
      cacheSizeBytes,
      clearAppCache,
      isClearingCache,
      openOverlayPermissionSettings,
      openSystemSettings,
      permissions,
      refreshCacheEstimate,
      settings,
      syncBrowserPermissions,
      toggleAdaptiveNetwork,
      toggleBackgroundPlayback,
      toggleCameraScanner,
      toggleDynamicIsland,
      toggleGalleryStorage,
      toggleHapticFeedback,
      toggleMediaNotifications,
      toggleSlipAutoVibe,
      toggleTwinNotifications,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings harus digunakan di dalam SettingsProvider');
  }
  return ctx;
}
