/**
 * Person segmentation: turns a camera frame into a soft mask of "where the person is".
 * Everything runs on the device. Implementations live next to this file; the rest of the
 * app only sees these types.
 */

/** Rectangle in fractions (0..1) of the mask's width and height. */
export interface NormRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Mask {
  width: number;
  height: number;
  /** One byte per pixel, row-major. 255 = definitely the person, 0 = background. */
  alpha: Uint8ClampedArray;
  /** Where the person is, or null when nobody is in the frame. */
  bbox: NormRect | null;
}

export type SegmenterKind = 'mediapipe' | 'fake';

export interface PersonSegmenter {
  readonly kind: SegmenterKind;
  /**
   * Segments `source` after scaling it to `width` x `height`. Callers pick a small probe
   * size (a few hundred pixels) that keeps the source's aspect ratio. Calls are serialised
   * inside the implementation; a rejected promise means this frame produced no mask.
   */
  segment(source: CanvasImageSource, width: number, height: number): Promise<Mask>;
  dispose(): void;
}

export type SegmentationStatus = 'unknown' | 'loading' | 'ready' | 'unsupported';

/** Live preview probe edge; small on purpose, the mask is upscaled with smoothing. */
export const LIVE_PROBE_EDGE = 320;
/** Probe edge for the still photo: cleaner edges, still well under a frame budget. */
export const CAPTURE_PROBE_EDGE = 512;
