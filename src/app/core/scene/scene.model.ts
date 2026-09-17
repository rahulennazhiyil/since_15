import { LAYOUTS, SCENE_SIZES, type LayoutId, type Rect, type SceneAspect } from '../photo/layouts';
import type { Size } from '../photo/image-encode';
import type { NormRect } from '../segmentation/segmenter';

/**
 * The shared scene: one background, up to two people, each placed by a small record that
 * both devices understand identically. Pure data and pure math; no canvas here.
 */

export type PersonRole = 'host' | 'guest';
export const PERSON_ROLES: readonly PersonRole[] = ['host', 'guest'];

export interface Placement {
  /** Centre of the person's frame as a fraction of the scene width. */
  x: number;
  /** Centre of the person's frame as a fraction of the scene height. */
  y: number;
  /** Drawn frame height divided by the scene height. */
  scale: number;
  /** Mirror the person horizontally (on top of how their camera was captured). */
  flip: boolean;
}

export interface BackgroundFx {
  /** 0 = sharp, 1 = strongest blur. */
  blur: number;
  /** 0 = as is, 1 = darkest. */
  dim: number;
}

export interface SceneState {
  /** Built-in id, `custom:<hash>`, or `none` for a plain surface. */
  backgroundId: string;
  fx: BackgroundFx;
  /** Frame around the scene; also decides the scene's aspect ratio. */
  layoutId: LayoutId;
  people: Partial<Record<PersonRole, Placement>>;
  /** Who is drawn last (on top). */
  front: PersonRole;
}

export const PLACEMENT_LIMITS = { minScale: 0.2, maxScale: 3, margin: 0.45 } as const;

export const DEFAULT_PLACEMENTS: Record<PersonRole, Placement> = {
  host: { x: 0.3, y: 0.58, scale: 0.9, flip: false },
  guest: { x: 0.7, y: 0.58, scale: 0.9, flip: false },
};

/** Single person, centred. */
export const SOLO_PLACEMENT: Placement = { x: 0.5, y: 0.55, scale: 0.92, flip: false };

export const DEFAULT_SCENE: SceneState = {
  backgroundId: 'none',
  fx: { blur: 0, dim: 0 },
  layoutId: 'single',
  people: { host: DEFAULT_PLACEMENTS.host, guest: DEFAULT_PLACEMENTS.guest },
  front: 'guest',
};

export function sceneAspectOf(layoutId: LayoutId): SceneAspect {
  return LAYOUTS[layoutId]?.sceneAspect ?? 'portrait';
}

export function sceneSizeOf(layoutId: LayoutId): Size {
  return SCENE_SIZES[sceneAspectOf(layoutId)];
}

// ---- validation -------------------------------------------------------------------

const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

export function isPersonRole(v: unknown): v is PersonRole {
  return v === 'host' || v === 'guest';
}

export function isPlacement(v: unknown): v is Placement {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return isNum(p['x'], -1, 2) && isNum(p['y'], -1, 2) && isNum(p['scale'], 0.05, 10) && typeof p['flip'] === 'boolean';
}

export function isBackgroundFx(v: unknown): v is BackgroundFx {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return isNum(f['blur'], 0, 1) && isNum(f['dim'], 0, 1);
}

export function isBackgroundId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64 && /^[a-z0-9:_-]+$/i.test(v);
}

export function isSceneState(v: unknown): v is SceneState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (!isBackgroundId(s['backgroundId']) || !isBackgroundFx(s['fx']) || !isPersonRole(s['front'])) return false;
  if (typeof s['layoutId'] !== 'string' || !(s['layoutId'] in LAYOUTS)) return false;
  const people = s['people'];
  if (!people || typeof people !== 'object') return false;
  for (const [role, placement] of Object.entries(people as object)) {
    if (!isPersonRole(role) || !isPlacement(placement)) return false;
  }
  return true;
}

// ---- math -------------------------------------------------------------------------

export function clampPlacement(p: Placement): Placement {
  const { minScale, maxScale, margin } = PLACEMENT_LIMITS;
  return {
    x: clamp(p.x, -margin, 1 + margin),
    y: clamp(p.y, -margin, 1 + margin),
    scale: clamp(p.scale, minScale, maxScale),
    flip: p.flip,
  };
}

/** Scene-pixel rectangle the person's whole frame is drawn into. */
export function frameRect(placement: Placement, frame: Size, scene: Size): Rect {
  const height = placement.scale * scene.height;
  const width = (height * frame.width) / frame.height;
  return {
    x: placement.x * scene.width - width / 2,
    y: placement.y * scene.height - height / 2,
    width,
    height,
  };
}

/** Scene-pixel rectangle of the person's body (their mask bbox) once placed. */
export function bodyRect(placement: Placement, frame: Size, bbox: NormRect | null, scene: Size): Rect {
  const fr = frameRect(placement, frame, scene);
  const b = bbox ?? FALLBACK_BBOX;
  const bx = placement.flip ? 1 - b.x - b.width : b.x;
  return { x: fr.x + bx * fr.width, y: fr.y + b.y * fr.height, width: b.width * fr.width, height: b.height * fr.height };
}

/** Where a person usually is when the model has not told us yet. */
export const FALLBACK_BBOX: NormRect = { x: 0.22, y: 0.08, width: 0.56, height: 0.92 };

export interface ArrangeInput {
  role: PersonRole;
  frame: Size;
  bbox: NormRect | null;
}

/**
 * Places one or two people so nobody overlaps: bodies centred at 30 % / 70 % of the width
 * (one person: 50 %), bottoms resting on the scene's bottom edge, heights matched. The
 * result is plain placements, so the device that pressed "arrange" sends them and both
 * devices draw the same thing.
 */
export function autoArrange(inputs: ArrangeInput[], scene: Size): Partial<Record<PersonRole, Placement>> {
  const out: Partial<Record<PersonRole, Placement>> = {};
  if (inputs.length === 0) return out;
  const ordered = [...inputs].sort((a, b) => PERSON_ROLES.indexOf(a.role) - PERSON_ROLES.indexOf(b.role));
  const targets = ordered.length === 1 ? [0.5] : [0.3, 0.7];
  const bodyHeight = ordered.length === 1 ? 0.86 : 0.78;
  const maxBodyWidth = ordered.length === 1 ? 0.8 : 0.38;

  ordered.forEach((input, i) => {
    const b = input.bbox ?? FALLBACK_BBOX;
    const aspect = (input.frame.width / input.frame.height) * (scene.height / scene.width);
    // scale so the body has the wanted height; shrink if the body would be too wide
    let scale = bodyHeight / Math.max(0.05, b.height);
    const bodyWidthNorm = b.width * scale * aspect;
    if (bodyWidthNorm > maxBodyWidth) scale *= maxBodyWidth / bodyWidthNorm;
    scale = clamp(scale, PLACEMENT_LIMITS.minScale, PLACEMENT_LIMITS.maxScale);

    // bottom of the body slightly below the frame edge hides the camera's cut-off line
    const y = 1.02 - (b.y + b.height) * scale + scale / 2;
    const x = targets[i] - (b.x + b.width / 2 - 0.5) * scale * aspect;
    out[input.role] = clampPlacement({ x, y, scale, flip: false });
  });

  // Wide cameras or a very close person can still collide after clamping: push apart.
  if (ordered.length === 2) {
    const [a, b] = ordered;
    const ra = bodyRect(out[a.role]!, a.frame, a.bbox, scene);
    const rb = bodyRect(out[b.role]!, b.frame, b.bbox, scene);
    const overlap = ra.x + ra.width + scene.width * 0.02 - rb.x;
    if (overlap > 0) {
      const shift = overlap / 2 / scene.width;
      out[a.role] = clampPlacement({ ...out[a.role]!, x: out[a.role]!.x - shift });
      out[b.role] = clampPlacement({ ...out[b.role]!, x: out[b.role]!.x + shift });
    }
  }
  return out;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

/** Roles drawn back to front. */
export function drawOrder(people: readonly PersonRole[], front: PersonRole): PersonRole[] {
  return [...people].sort((a, b) => (a === front ? 1 : 0) - (b === front ? 1 : 0));
}

/** Front-most person under a scene-pixel point, or null. */
export function hitTest(
  point: { x: number; y: number },
  people: { role: PersonRole; placement: Placement; frame: Size; bbox: NormRect | null }[],
  front: PersonRole,
  scene: Size,
): PersonRole | null {
  const order = drawOrder(
    people.map((p) => p.role),
    front,
  ).reverse();
  for (const role of order) {
    const p = people.find((q) => q.role === role);
    if (p && pointInRect(point.x, point.y, bodyRect(p.placement, p.frame, p.bbox, scene))) return role;
  }
  return null;
}

/** Shallow patch that keeps every field valid. */
export function applyScenePatch(scene: SceneState, patch: Partial<SceneState>): SceneState {
  const next: SceneState = { ...scene, ...patch, fx: { ...scene.fx, ...(patch.fx ?? {}) }, people: { ...scene.people, ...(patch.people ?? {}) } };
  for (const role of PERSON_ROLES) {
    const p = next.people[role];
    if (p) next.people[role] = clampPlacement(p);
  }
  return next;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
