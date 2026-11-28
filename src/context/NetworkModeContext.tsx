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
  NetworkMode,
  isAdaptiveNetworkModeEnabled,
  setCurrentNetworkModeState,
  subscribeApiTiming,
} from '../utils/networkTelemetry';

const DISMISSED_LITE_PROMPT_KEY = 'nocty_lite_prompt_dismissed_v1';
const DISMISSED_RECOVERY_PROMPT_KEY = 'nocty_recovery_prompt_dismissed_v1';

const INITIAL_GRACE_MS = 12_000;
const TRACK_PLAY_GRACE_MS = 4_000;
const STALL_DURATION_THRESHOLD_MS = 3_500;
const STALL_WINDOW_MS = 45_000;
const SLOW_API_THRESHOLD_MS = 4_500;
const SLOW_NETWORK_SUSTAIN_MS = 6_000;
const FAST_RECOVERY_SUSTAIN_MS = 15_000;

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
}

function getNavigatorConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string, value: boolean): void {
  try {
    if (value) {
      sessionStorage.setItem(key, '1');
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage restriction
  }
}

interface NetworkModeContextValue {
  mode: NetworkMode;
  setMode: (mode: NetworkMode) => void;
  isAppInBackground: boolean;
  isWeakNetworkPromptVisible: boolean;
  isRecoveryPromptVisible: boolean;
  acceptLiteMode: () => void;
  dismissLitePrompt: () => void;
  acceptNormalMode: () => void;
  dismissRecoveryPrompt: () => void;
  notifyTrackPlayStart: () => void;
  notifyPlayerBufferingState: (isBuffering: boolean, isPlaying: boolean) => void;
  notifyPlayerStallEvent: () => void;
}

const NetworkModeContext = createContext<NetworkModeContextValue | null>(null);

export const NetworkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<NetworkMode>('normal');
  const [isAppInBackground, setIsAppInBackground] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );
  const [isWeakNetworkPromptVisible, setIsWeakNetworkPromptVisible] = useState(false);
  const [isRecoveryPromptVisible, setIsRecoveryPromptVisible] = useState(false);

  const modeRef = useRef<NetworkMode>('normal');
  const mountGraceUntilRef = useRef<number>(Date.now() + INITIAL_GRACE_MS);
  const trackGraceUntilRef = useRef<number>(0);
  const stallStartedAtRef = useRef<number | null>(null);
  const stallEventsRef = useRef<number[]>([]);
  const consecutiveSlowApiRef = useRef<number>(0);
  const slowConnectionSinceRef = useRef<number | null>(null);
  const fastConnectionSinceRef = useRef<number | null>(null);

  const setMode = useCallback((nextMode: NetworkMode) => {
    modeRef.current = nextMode;
    setCurrentNetworkModeState(nextMode);
    setModeState(nextMode);
    if (nextMode === 'lite') {
      setIsWeakNetworkPromptVisible(false);
      fastConnectionSinceRef.current = null;
    } else {
      setIsRecoveryPromptVisible(false);
      slowConnectionSinceRef.current = null;
      consecutiveSlowApiRef.current = 0;
      stallEventsRef.current = [];
      stallStartedAtRef.current = null;
    }
  }, []);

  const isInGracePeriod = useCallback(() => {
    const now = Date.now();
    return now < mountGraceUntilRef.current || now < trackGraceUntilRef.current;
  }, []);

  const triggerWeakNetworkConsent = useCallback(() => {
    if (!isAdaptiveNetworkModeEnabled()) return;
    if (modeRef.current !== 'normal') return;
    if (isInGracePeriod()) return;
    if (readSessionFlag(DISMISSED_LITE_PROMPT_KEY)) return;
    setIsWeakNetworkPromptVisible(true);
  }, [isInGracePeriod]);

  const acceptLiteMode = useCallback(() => {
    writeSessionFlag(DISMISSED_RECOVERY_PROMPT_KEY, false);
    setMode('lite');
  }, [setMode]);

  const dismissLitePrompt = useCallback(() => {
    writeSessionFlag(DISMISSED_LITE_PROMPT_KEY, true);
    setIsWeakNetworkPromptVisible(false);
  }, []);

  const acceptNormalMode = useCallback(() => {
    writeSessionFlag(DISMISSED_LITE_PROMPT_KEY, false);
    setMode('normal');
  }, [setMode]);

  const dismissRecoveryPrompt = useCallback(() => {
    writeSessionFlag(DISMISSED_RECOVERY_PROMPT_KEY, true);
    setIsRecoveryPromptVisible(false);
  }, []);

  const notifyTrackPlayStart = useCallback(() => {
    trackGraceUntilRef.current = Date.now() + TRACK_PLAY_GRACE_MS;
    stallStartedAtRef.current = null;
  }, []);

  const notifyPlayerStallEvent = useCallback(() => {
    if (modeRef.current !== 'normal') return;
    if (isInGracePeriod()) return;

    const now = Date.now();
    const recent = stallEventsRef.current.filter((t) => now - t <= STALL_WINDOW_MS);
    const last = recent[recent.length - 1];
    // Avoid counting duplicate rapid events from the exact same stutter (< 1.5s apart)
    if (!last || now - last > 1500) {
      recent.push(now);
    }
    stallEventsRef.current = recent;

    if (recent.length >= 2) {
      triggerWeakNetworkConsent();
    }
  }, [isInGracePeriod, triggerWeakNetworkConsent]);

  const notifyPlayerBufferingState = useCallback(
    (isBuffering: boolean, isPlaying: boolean) => {
      if (!isBuffering || isPlaying) {
        stallStartedAtRef.current = null;
        return;
      }

      if (stallStartedAtRef.current === null) {
        stallStartedAtRef.current = Date.now();
      }
    },
    []
  );

  // Sync html.lite-mode class on documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'lite') {
      root.classList.add('lite-mode');
    } else {
      root.classList.remove('lite-mode');
    }
  }, [mode]);

  // Track foreground/background visibility so hidden tabs/locked phones halt video iframes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisChange = () => {
      setIsAppInBackground(document.hidden);
    };
    onVisChange();
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  // Subscribe to API timing telemetry (> 4.5s consecutively triggers weak signal consent)
  useEffect(() => {
    return subscribeApiTiming((durationMs, didTimeout) => {
      if (modeRef.current !== 'normal') return;
      if (isInGracePeriod()) return;

      if (didTimeout || durationMs > SLOW_API_THRESHOLD_MS) {
        consecutiveSlowApiRef.current += 1;
        if (consecutiveSlowApiRef.current >= 2) {
          triggerWeakNetworkConsent();
        }
      } else {
        consecutiveSlowApiRef.current = 0;
      }
    });
  }, [isInGracePeriod, triggerWeakNetworkConsent]);

  // Periodic monitor for sustained buffering stalls (> 3.5s) and navigator.connection (6s slow / 15s recovery)
  useEffect(() => {
    const conn = getNavigatorConnection();

    const evaluate = () => {
      if (!isAdaptiveNetworkModeEnabled()) {
        setIsWeakNetworkPromptVisible(false);
        return;
      }
      const now = Date.now();

      // 1. Check ongoing audio/player stall duration
      if (
        modeRef.current === 'normal' &&
        stallStartedAtRef.current !== null &&
        !isInGracePeriod()
      ) {
        const stallElapsed = now - stallStartedAtRef.current;
        if (stallElapsed > STALL_DURATION_THRESHOLD_MS) {
          triggerWeakNetworkConsent();
        }
      }

      // 2. Check Navigator Network Information API
      if (conn) {
        const eff = conn.effectiveType || '';
        const dl = typeof conn.downlink === 'number' ? conn.downlink : null;
        const isSlowReported =
          eff === '2g' ||
          eff === 'slow-2g' ||
          (dl !== null && dl > 0 && dl < 0.8);

        if (modeRef.current === 'normal') {
          if (isSlowReported && !isInGracePeriod()) {
            if (slowConnectionSinceRef.current === null) {
              slowConnectionSinceRef.current = now;
            } else if (now - slowConnectionSinceRef.current >= SLOW_NETWORK_SUSTAIN_MS) {
              triggerWeakNetworkConsent();
            }
          } else {
            slowConnectionSinceRef.current = null;
          }
        } else if (modeRef.current === 'lite') {
          const isFastRecovered =
            dl !== null && dl > 3 && (!eff || eff === '4g');
          if (isFastRecovered && !readSessionFlag(DISMISSED_RECOVERY_PROMPT_KEY)) {
            if (fastConnectionSinceRef.current === null) {
              fastConnectionSinceRef.current = now;
            } else if (now - fastConnectionSinceRef.current >= FAST_RECOVERY_SUSTAIN_MS) {
              setIsRecoveryPromptVisible(true);
            }
          } else {
            fastConnectionSinceRef.current = null;
          }
        }
      }
    };

    const interval = window.setInterval(evaluate, 1000);
    conn?.addEventListener('change', evaluate);

    return () => {
      window.clearInterval(interval);
      conn?.removeEventListener('change', evaluate);
    };
  }, [isInGracePeriod, triggerWeakNetworkConsent]);

  const value = useMemo<NetworkModeContextValue>(
    () => ({
      mode,
      setMode,
      isAppInBackground,
      isWeakNetworkPromptVisible,
      isRecoveryPromptVisible,
      acceptLiteMode,
      dismissLitePrompt,
      acceptNormalMode,
      dismissRecoveryPrompt,
      notifyTrackPlayStart,
      notifyPlayerBufferingState,
      notifyPlayerStallEvent,
    }),
    [
      acceptLiteMode,
      acceptNormalMode,
      dismissLitePrompt,
      dismissRecoveryPrompt,
      isAppInBackground,
      isRecoveryPromptVisible,
      isWeakNetworkPromptVisible,
      mode,
      notifyPlayerBufferingState,
      notifyPlayerStallEvent,
      notifyTrackPlayStart,
      setMode,
    ]
  );

  return <NetworkModeContext.Provider value={value}>{children}</NetworkModeContext.Provider>;
};

export function useNetworkMode(): NetworkModeContextValue {
  const ctx = useContext(NetworkModeContext);
  if (!ctx) {
    throw new Error('useNetworkMode must be used within NetworkModeProvider');
  }
  return ctx;
}
