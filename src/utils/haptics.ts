const SETTINGS_STORAGE_KEY = 'nocty_app_settings_v1';

function readInitialHapticFlag(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { hapticFeedbackEnabled?: unknown };
    if (typeof parsed.hapticFeedbackEnabled === 'boolean') {
      return parsed.hapticFeedbackEnabled;
    }
    return true;
  } catch {
    return true;
  }
}

let hapticEnabledFlag = readInitialHapticFlag();

export function setHapticFeedbackEnabledState(enabled: boolean): void {
  hapticEnabledFlag = Boolean(enabled);
}

export function isHapticFeedbackEnabled(): boolean {
  return hapticEnabledFlag;
}

/**
 * Triggers a subtle micro-vibration (default 12ms) on supported Android/Web devices
 * when Haptic Feedback is enabled in Nocty Settings.
 */
export function triggerHaptic(durationMs = 12): void {
  if (!hapticEnabledFlag) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Ignore unsupported or restricted vibration call
  }
}
