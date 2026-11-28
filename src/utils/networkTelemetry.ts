export type NetworkMode = 'normal' | 'lite';

type ApiTimingListener = (durationMs: number, didTimeout: boolean) => void;

let currentNetworkMode: NetworkMode = 'normal';
let adaptiveNetworkEnabled = true;
const apiTimingListeners = new Set<ApiTimingListener>();

export function getCurrentNetworkMode(): NetworkMode {
  return currentNetworkMode;
}

export function setCurrentNetworkModeState(mode: NetworkMode): void {
  currentNetworkMode = mode;
}

export function isAdaptiveNetworkModeEnabled(): boolean {
  return adaptiveNetworkEnabled;
}

export function setAdaptiveNetworkModeEnabledState(enabled: boolean): void {
  adaptiveNetworkEnabled = enabled;
}

export function subscribeApiTiming(listener: ApiTimingListener): () => void {
  apiTimingListeners.add(listener);
  return () => {
    apiTimingListeners.delete(listener);
  };
}

export function reportApiTiming(durationMs: number, didTimeout = false): void {
  apiTimingListeners.forEach((listener) => {
    try {
      listener(durationMs, didTimeout);
    } catch {
      // Ignore listener errors
    }
  });
}

export function resizeCoverUrlForMode(
  url: string,
  mode: NetworkMode,
  sizeHint: 'xs' | 'sm' | 'md' | 'lg' = 'md'
): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const targetAppleSize =
    mode === 'lite'
      ? '100x100bb'
      : sizeHint === 'xs'
        ? '100x100bb'
        : sizeHint === 'sm'
          ? '300x300bb'
          : '600x600bb';

  let out = url;

  // Apple / iTunes artwork resizing
  if (out.includes('mzstatic.com')) {
    out = out.replace(/\d+x\d+bb/g, targetAppleSize);
  }

  // JioSaavn artwork resizing
  if (out.includes('saavncdn.com')) {
    const targetSaavn = mode === 'lite' || sizeHint === 'xs' ? '-150x150' : '-500x500';
    out = out.replace(/-(?:500x500|150x150|50x50)/g, targetSaavn);
  }

  // YouTube thumbnail resizing in Lite mode
  if (mode === 'lite' && out.includes('i.ytimg.com/vi/')) {
    const targetYt = sizeHint === 'xs' || sizeHint === 'sm' ? 'default.jpg' : 'mqdefault.jpg';
    out = out.replace(/\/(?:maxresdefault|sddefault|hqdefault)\.jpg/i, `/${targetYt}`);
  }

  return out;
}
