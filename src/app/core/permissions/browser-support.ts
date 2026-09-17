export interface BrowserSupport {
  secureContext: boolean;
  camera: boolean;
  webrtc: boolean;
  canvas: boolean;
  offscreenCanvas: boolean;
  /** CanvasRenderingContext2D.filter; when false the filter engine uses a pixel fallback. */
  canvasFilter: boolean;
  broadcastChannel: boolean;
  shareFiles: boolean;
}

let cached: BrowserSupport | null = null;

/** Feature detection, evaluated once. Nothing here throws in any browser. */
export function detectBrowserSupport(): BrowserSupport {
  if (cached) return cached;

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;

  let canvas = false;
  let canvasFilter = false;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    canvas = !!ctx;
    canvasFilter = !!ctx && 'filter' in ctx;
  } catch {
    canvas = false;
  }

  let shareFiles = false;
  try {
    shareFiles =
      !!nav?.share &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [new File([''], 'probe.jpg', { type: 'image/jpeg' })] });
  } catch {
    shareFiles = false;
  }

  cached = {
    secureContext: win?.isSecureContext ?? false,
    camera: typeof nav?.mediaDevices?.getUserMedia === 'function',
    webrtc: typeof win?.RTCPeerConnection === 'function',
    canvas,
    offscreenCanvas: typeof win?.OffscreenCanvas === 'function',
    canvasFilter,
    broadcastChannel: typeof win?.BroadcastChannel === 'function',
    shareFiles,
  };
  return cached;
}

/** Test seam. */
export function resetBrowserSupportCache(): void {
  cached = null;
}
