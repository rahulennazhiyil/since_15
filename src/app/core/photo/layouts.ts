import type { Size } from './image-encode';

export type LayoutId =
  | 'single'
  | 'polaroid'
  | 'heart'
  | 'strip3'
  | 'strip4'
  | 'grid4'
  | 'pairSideBySide'
  | 'pairStacked'
  | 'pairPolaroid'
  | 'pairPip'
  | 'pairHeart'
  | 'pairStrip3'
  | 'pairStrip4';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  width: number;
  height: number;
  /** One rectangle per source, in shot order; for pairs: shot0 A, shot0 B, shot1 A, ... */
  slots: Rect[];
  /** Area reserved for caption text, when the layout has one. */
  caption?: Rect;
  /** Clip applied around all slots (frame background shows outside). */
  clip?: 'heart';
}

/** Shape of the shared scene a single-source layout expects to receive. */
export type SceneAspect = 'portrait' | 'square' | 'wide';

/** Pixel size of the composed scene per aspect; the photo frame scales it as needed. */
export const SCENE_SIZES: Record<SceneAspect, Size> = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1350, height: 1350 },
  wide: { width: 1600, height: 1200 },
};

export interface Layout {
  id: LayoutId;
  name: string;
  shots: number;
  /** Sources per shot: 1 for solo layouts, 2 for couple layouts. */
  people: 1 | 2;
  /** For single-source layouts: which scene shape fills the slot without cropping people. */
  sceneAspect?: SceneAspect;
  compute(source: Size): LayoutResult;
}

/** Centre-crops a source so it fills a destination of a different aspect ratio. */
export function coverCrop(srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): Rect {
  const srcAspect = srcWidth / srcHeight;
  const dstAspect = dstWidth / dstHeight;
  if (srcAspect > dstAspect) {
    const width = Math.round(srcHeight * dstAspect);
    return { x: Math.round((srcWidth - width) / 2), y: 0, width, height: srcHeight };
  }
  const height = Math.round(srcWidth / dstAspect);
  return { x: 0, y: Math.round((srcHeight - height) / 2), width: srcWidth, height };
}

const PAD = 36;
const GAP = 24;
const CAPTION = 110;

const single: Layout = {
  id: 'single',
  name: 'Single',
  shots: 1,
  people: 1,
  sceneAspect: 'portrait',
  compute: (source) => ({
    width: source.width,
    height: source.height,
    slots: [{ x: 0, y: 0, width: source.width, height: source.height }],
  }),
};

function strip(id: LayoutId, name: string, shots: number): Layout {
  const WIDTH = 720;
  const slotWidth = WIDTH - PAD * 2;
  const slotHeight = Math.round((slotWidth * 3) / 4);
  return {
    id,
    name,
    shots,
    people: 1,
    sceneAspect: 'wide',
    compute: () => {
      const slots: Rect[] = [];
      for (let i = 0; i < shots; i++) {
        slots.push({ x: PAD, y: PAD + i * (slotHeight + GAP), width: slotWidth, height: slotHeight });
      }
      const captionY = PAD + shots * slotHeight + (shots - 1) * GAP;
      return {
        width: WIDTH,
        height: captionY + CAPTION + PAD / 2,
        slots,
        caption: { x: PAD, y: captionY, width: slotWidth, height: CAPTION },
      };
    },
  };
}

const grid4: Layout = {
  id: 'grid4',
  name: 'Burst',
  shots: 4,
  people: 1,
  sceneAspect: 'wide',
  compute: () => {
    const WIDTH = 1080;
    const slotWidth = (WIDTH - PAD * 2 - GAP) / 2;
    const slotHeight = Math.round((slotWidth * 3) / 4);
    const slots: Rect[] = [];
    for (let i = 0; i < 4; i++) {
      slots.push({
        x: PAD + (i % 2) * (slotWidth + GAP),
        y: PAD + Math.floor(i / 2) * (slotHeight + GAP),
        width: slotWidth,
        height: slotHeight,
      });
    }
    const captionY = PAD + 2 * slotHeight + GAP;
    return {
      width: WIDTH,
      height: captionY + CAPTION + PAD / 2,
      slots,
      caption: { x: PAD, y: captionY, width: WIDTH - PAD * 2, height: CAPTION },
    };
  },
};

/** One square picture on a Polaroid-style card with room to write underneath. */
const polaroid: Layout = {
  id: 'polaroid',
  name: 'Polaroid',
  shots: 1,
  people: 1,
  sceneAspect: 'square',
  compute: () => {
    const WIDTH = 1080;
    const slot = WIDTH - PAD * 2;
    const captionY = PAD + slot;
    return {
      width: WIDTH,
      height: captionY + CAPTION * 1.6 + PAD / 2,
      slots: [{ x: PAD, y: PAD, width: slot, height: slot }],
      caption: { x: PAD, y: captionY, width: slot, height: CAPTION * 1.6 },
    };
  },
};

/** One picture clipped to a heart. */
const heart: Layout = {
  id: 'heart',
  name: 'Heart',
  shots: 1,
  people: 1,
  sceneAspect: 'square',
  compute: () => {
    const size = 1200;
    return { width: size, height: size, clip: 'heart', slots: [{ x: 0, y: 0, width: size, height: size }] };
  },
};

/** Two portrait-ish frames next to each other, edge to edge. */
const pairSideBySide: Layout = {
  id: 'pairSideBySide',
  name: 'Side by side',
  shots: 1,
  people: 2,
  compute: () => {
    const slot = { width: 720, height: 900 };
    return {
      width: slot.width * 2,
      height: slot.height,
      slots: [
        { x: 0, y: 0, ...slot },
        { x: slot.width, y: 0, ...slot },
      ],
    };
  },
};

const pairStacked: Layout = {
  id: 'pairStacked',
  name: 'Stacked',
  shots: 1,
  people: 2,
  compute: () => {
    const slot = { width: 1080, height: 720 };
    return {
      width: slot.width,
      height: slot.height * 2,
      slots: [
        { x: 0, y: 0, ...slot },
        { x: 0, y: slot.height, ...slot },
      ],
    };
  },
};

const pairPolaroid: Layout = {
  id: 'pairPolaroid',
  name: 'Polaroid',
  shots: 1,
  people: 2,
  compute: () => {
    const WIDTH = 1200;
    const slotWidth = (WIDTH - PAD * 2 - GAP) / 2;
    const slotHeight = Math.round(slotWidth * 1.15);
    const captionY = PAD + slotHeight;
    return {
      width: WIDTH,
      height: captionY + CAPTION * 1.6 + PAD / 2,
      slots: [
        { x: PAD, y: PAD, width: slotWidth, height: slotHeight },
        { x: PAD + slotWidth + GAP, y: PAD, width: slotWidth, height: slotHeight },
      ],
      caption: { x: PAD, y: captionY, width: WIDTH - PAD * 2, height: CAPTION * 1.6 },
    };
  },
};

/** The partner large, you tucked in the corner. */
const pairPip: Layout = {
  id: 'pairPip',
  name: 'Picture in picture',
  shots: 1,
  people: 2,
  compute: () => {
    const width = 1280;
    const height = 960;
    const inset = { width: 400, height: 300 };
    return {
      width,
      height,
      slots: [
        { x: width - inset.width - PAD, y: height - inset.height - PAD, ...inset },
        { x: 0, y: 0, width, height },
      ],
    };
  },
};

const pairHeart: Layout = {
  id: 'pairHeart',
  name: 'Heart',
  shots: 1,
  people: 2,
  compute: () => {
    const size = 1200;
    return {
      width: size,
      height: size,
      clip: 'heart',
      slots: [
        { x: 0, y: 0, width: size / 2, height: size },
        { x: size / 2, y: 0, width: size / 2, height: size },
      ],
    };
  },
};

function pairStrip(id: LayoutId, name: string, shots: number): Layout {
  const WIDTH = 960;
  const slotWidth = (WIDTH - PAD * 2 - GAP) / 2;
  const slotHeight = Math.round(slotWidth * 1.1);
  return {
    id,
    name,
    shots,
    people: 2,
    compute: () => {
      const slots: Rect[] = [];
      for (let i = 0; i < shots; i++) {
        const y = PAD + i * (slotHeight + GAP);
        slots.push({ x: PAD, y, width: slotWidth, height: slotHeight });
        slots.push({ x: PAD + slotWidth + GAP, y, width: slotWidth, height: slotHeight });
      }
      const captionY = PAD + shots * slotHeight + (shots - 1) * GAP;
      return {
        width: WIDTH,
        height: captionY + CAPTION + PAD / 2,
        slots,
        caption: { x: PAD, y: captionY, width: WIDTH - PAD * 2, height: CAPTION },
      };
    },
  };
}

export const LAYOUTS: Record<LayoutId, Layout> = {
  single,
  polaroid,
  heart,
  strip3: strip('strip3', 'Strip of 3', 3),
  strip4: strip('strip4', 'Strip of 4', 4),
  grid4,
  pairSideBySide,
  pairStacked,
  pairPolaroid,
  pairPip,
  pairHeart,
  pairStrip3: pairStrip('pairStrip3', 'Strip of 3', 3),
  pairStrip4: pairStrip('pairStrip4', 'Strip of 4', 4),
};

/** Frames for the shared scene (one merged picture), in display order. */
export const TOGETHER_LAYOUT_CHOICES: readonly LayoutId[] = ['single', 'polaroid', 'heart'];

/** Classic couple layouts (two separate frames) a user can pick for single-shot modes. */
export const PAIR_LAYOUT_CHOICES: readonly LayoutId[] = ['pairSideBySide', 'pairStacked', 'pairPolaroid', 'pairHeart', 'pairPip'];

/** Heart outline normalised to a unit square, as canvas path commands. */
export function heartPath(ctx: CanvasPath, width: number, height: number): void {
  const w = width;
  const h = height;
  ctx.moveTo(w * 0.5, h * 0.92);
  ctx.bezierCurveTo(w * 0.02, h * 0.6, w * 0.0, h * 0.22, w * 0.27, h * 0.1);
  ctx.bezierCurveTo(w * 0.4, h * 0.05, w * 0.48, h * 0.14, w * 0.5, h * 0.24);
  ctx.bezierCurveTo(w * 0.52, h * 0.14, w * 0.6, h * 0.05, w * 0.73, h * 0.1);
  ctx.bezierCurveTo(w * 1.0, h * 0.22, w * 0.98, h * 0.6, w * 0.5, h * 0.92);
  ctx.closePath();
}
