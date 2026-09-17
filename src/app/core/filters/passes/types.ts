export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** A compositing layer shared by the canvas renderer and the CSS live preview. */
export interface BlendLayer {
  /** CSS background value: a colour, a gradient, or an image url(). */
  background: string;
  blend: GlobalCompositeOperation;
  /** 0..1 */
  opacity: number;
  /** Optional CSS backdrop-filter for the preview only (canvas equivalents handle it themselves). */
  backdropFilter?: string;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
