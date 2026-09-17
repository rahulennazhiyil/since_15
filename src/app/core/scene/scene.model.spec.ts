import { describe, expect, it } from 'vitest';
import { SCENE_SIZES } from '../photo/layouts';
import {
  DEFAULT_SCENE,
  applyScenePatch,
  autoArrange,
  bodyRect,
  clampPlacement,
  drawOrder,
  frameRect,
  hitTest,
  isPlacement,
  isSceneState,
  rectsOverlap,
  sceneAspectOf,
} from './scene.model';

const scene = SCENE_SIZES.portrait;
const phoneFrame = { width: 720, height: 1280 };
const laptopFrame = { width: 1280, height: 720 };

describe('scene model', () => {
  it('validates placements and whole scenes', () => {
    expect(isPlacement({ x: 0.3, y: 0.5, scale: 1, flip: false })).toBe(true);
    expect(isPlacement({ x: 0.3, y: 0.5, scale: 0, flip: false })).toBe(false);
    expect(isPlacement({ x: 'a', y: 0.5, scale: 1, flip: false })).toBe(false);
    expect(isSceneState(DEFAULT_SCENE)).toBe(true);
    expect(isSceneState({ ...DEFAULT_SCENE, layoutId: 'nope' })).toBe(false);
    expect(isSceneState({ ...DEFAULT_SCENE, backgroundId: 'bad id!' })).toBe(false);
    expect(isSceneState({ ...DEFAULT_SCENE, people: { alien: DEFAULT_SCENE.people.host } })).toBe(false);
    expect(isSceneState({ ...DEFAULT_SCENE, fx: { blur: 2, dim: 0 } })).toBe(false);
  });

  it('clamps placements and patches keep fields valid', () => {
    const clamped = clampPlacement({ x: 9, y: -9, scale: 100, flip: true });
    expect(clamped).toEqual({ x: 1.45, y: -0.45, scale: 3, flip: true });
    const patched = applyScenePatch(DEFAULT_SCENE, { fx: { blur: 0.5, dim: 0 }, people: { host: { x: 5, y: 0.5, scale: 1, flip: false } } });
    expect(patched.fx).toEqual({ blur: 0.5, dim: 0 });
    expect(patched.people.host?.x).toBe(1.45);
    expect(patched.people.guest).toEqual(DEFAULT_SCENE.people.guest);
  });

  it('derives the scene aspect from the frame layout', () => {
    expect(sceneAspectOf('single')).toBe('portrait');
    expect(sceneAspectOf('polaroid')).toBe('square');
    expect(sceneAspectOf('strip3')).toBe('wide');
    expect(sceneAspectOf('pairHeart')).toBe('portrait'); // classic layouts fall back
  });

  it('frame and body rectangles follow the placement', () => {
    const p = { x: 0.5, y: 0.5, scale: 1, flip: false };
    const fr = frameRect(p, phoneFrame, scene);
    expect(fr.height).toBe(scene.height);
    expect(fr.width).toBeCloseTo((scene.height * 720) / 1280, 5);
    expect(fr.x + fr.width / 2).toBeCloseTo(scene.width / 2, 5);
    const body = bodyRect(p, phoneFrame, { x: 0.25, y: 0.1, width: 0.5, height: 0.8 }, scene);
    expect(body.y).toBeCloseTo(fr.y + 0.1 * fr.height, 5);
    expect(body.width).toBeCloseTo(0.5 * fr.width, 5);
    const flipped = bodyRect({ ...p, flip: true }, phoneFrame, { x: 0.1, y: 0, width: 0.3, height: 1 }, scene);
    expect(flipped.x).toBeCloseTo(fr.x + 0.6 * fr.width, 5);
  });

  it('auto-arrange keeps two people apart and inside the scene, for phone and laptop frames', () => {
    const cases = [
      [
        { role: 'host' as const, frame: phoneFrame, bbox: { x: 0.2, y: 0.1, width: 0.6, height: 0.9 } },
        { role: 'guest' as const, frame: laptopFrame, bbox: { x: 0.3, y: 0.15, width: 0.4, height: 0.85 } },
      ],
      [
        { role: 'host' as const, frame: laptopFrame, bbox: null },
        { role: 'guest' as const, frame: laptopFrame, bbox: { x: 0.05, y: 0.05, width: 0.9, height: 0.95 } },
      ],
    ];
    for (const inputs of cases) {
      const placed = autoArrange(inputs, scene);
      const bodies = inputs.map((i) => bodyRect(placed[i.role]!, i.frame, i.bbox, scene));
      expect(rectsOverlap(bodies[0], bodies[1])).toBe(false);
      for (const b of bodies) {
        expect(b.y).toBeGreaterThanOrEqual(0);
        // bottoms rest just below the edge so the camera cut-off stays hidden
        expect(b.y + b.height).toBeCloseTo(scene.height * 1.02, -1);
      }
      // host on the left
      expect(bodies[0].x + bodies[0].width / 2).toBeLessThan(bodies[1].x + bodies[1].width / 2);
    }
  });

  it('auto-arrange centres a single person', () => {
    const placed = autoArrange([{ role: 'host', frame: phoneFrame, bbox: { x: 0.3, y: 0.1, width: 0.4, height: 0.9 } }], scene);
    const body = bodyRect(placed.host!, phoneFrame, { x: 0.3, y: 0.1, width: 0.4, height: 0.9 }, scene);
    expect(body.x + body.width / 2).toBeCloseTo(scene.width / 2, 0);
  });

  it('draw order puts the front person last and hit testing prefers them', () => {
    expect(drawOrder(['host', 'guest'], 'host')).toEqual(['guest', 'host']);
    const people = [
      { role: 'host' as const, placement: { x: 0.5, y: 0.5, scale: 1, flip: false }, frame: phoneFrame, bbox: null },
      { role: 'guest' as const, placement: { x: 0.5, y: 0.5, scale: 1, flip: false }, frame: phoneFrame, bbox: null },
    ];
    expect(hitTest({ x: scene.width / 2, y: scene.height / 2 }, people, 'guest', scene)).toBe('guest');
    expect(hitTest({ x: scene.width / 2, y: scene.height / 2 }, people, 'host', scene)).toBe('host');
    expect(hitTest({ x: 1, y: 1 }, people, 'host', scene)).toBeNull();
  });
});
