export interface SegmentationSupport {
  wasm: boolean;
  webgl2: boolean;
  imageBitmap: boolean;
  /** Everything the on-device model needs before we even try to load it. */
  ok: boolean;
}

let cached: SegmentationSupport | null = null;

/** Cheap, synchronous checks. Nothing here throws in any browser. */
export function detectSegmentationSupport(): SegmentationSupport {
  if (cached) return cached;
  const wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  let webgl2 = false;
  try {
    const canvas = document.createElement('canvas');
    webgl2 = !!canvas.getContext('webgl2');
  } catch {
    webgl2 = false;
  }
  const imageBitmap = typeof createImageBitmap === 'function';
  // WebGL is preferred but the CPU delegate works without it.
  cached = { wasm, webgl2, imageBitmap, ok: wasm && imageBitmap };
  return cached;
}

/** Test seam. */
export function resetSegmentationSupportCache(): void {
  cached = null;
}
