import { describe, expect, it } from 'vitest';
import { FilterDraft, MAX_OVERLAYS } from './filter-draft';
import { NEUTRAL_ADJUSTMENTS, createFilter, isNeutralAdjustments, isNeutralEffects } from './filter.model';

describe('FilterDraft', () => {
  it('starts neutral, unnamed and invalid', () => {
    const d = new FilterDraft();
    expect(isNeutralAdjustments(d.adjustments())).toBe(true);
    expect(isNeutralEffects(d.effects())).toBe(true);
    expect(d.isValid()).toBe(false);
    expect(d.definition().name).toBe('My filter');
    expect(d.definition().isCustom).toBe(true);
    expect(d.definition().category).toBe('custom');
  });

  it('copies an existing filter without sharing references', () => {
    const src = createFilter({
      id: 'f1',
      name: 'Src',
      category: 'custom',
      adjustments: { contrast: 1.3 },
      overlays: [{ id: 'o1', kind: 'emoji', content: '❤️', x: 0.5, y: 0.5, scale: 0.1, rotation: 0, opacity: 1 }],
      createdAt: 123,
    });
    const d = new FilterDraft(src);
    d.setAdjustment('contrast', 1.0);
    d.updateOverlay('o1', { x: 0.9 });
    expect(src.adjustments.contrast).toBe(1.3);
    expect(src.overlays[0].x).toBe(0.5);
    expect(d.id).toBe('f1');
    expect(d.definition().createdAt).toBe(123);
  });

  it('clamps adjustments to their ranges and names to their max length', () => {
    const d = new FilterDraft();
    d.setAdjustment('brightness', 99);
    d.setAdjustment('hue', -999);
    d.setName('x'.repeat(50));
    expect(d.adjustments().brightness).toBe(1.5);
    expect(d.adjustments().hue).toBe(-180);
    expect(d.name()).toHaveLength(24);
    expect(d.isValid()).toBe(true);
  });

  it('adds, selects, moves, clamps and removes overlays', () => {
    const d = new FilterDraft();
    const o = d.addOverlay('emoji', '✨');
    expect(o).not.toBeNull();
    expect(d.selectedOverlay()?.id).toBe(o!.id);

    d.nudgeOverlay(o!.id, 0.7, -0.9);
    expect(d.overlays()[0].x).toBe(1);
    expect(d.overlays()[0].y).toBe(0);

    d.updateOverlay(o!.id, { scale: 5, rotation: -30, opacity: 2 });
    expect(d.overlays()[0]).toMatchObject({ scale: 0.6, rotation: 330, opacity: 1 });

    d.removeOverlay(o!.id);
    expect(d.overlays()).toEqual([]);
    expect(d.selectedOverlay()).toBeNull();
  });

  it('refuses more than the maximum number of overlays', () => {
    const d = new FilterDraft();
    for (let i = 0; i < MAX_OVERLAYS; i++) expect(d.addOverlay('emoji', '❤️')).not.toBeNull();
    expect(d.canAddOverlay()).toBe(false);
    expect(d.addOverlay('emoji', '❤️')).toBeNull();
  });

  it('reset returns adjustments to neutral', () => {
    const d = new FilterDraft();
    d.setAdjustment('saturation', 0);
    d.setEffect('grain', 0.5);
    d.setDateStamp(true);
    d.resetAdjustments();
    d.resetEffects();
    expect(d.adjustments()).toEqual(NEUTRAL_ADJUSTMENTS);
    expect(d.effects().grain).toBe(0);
    expect(d.effects().dateStamp).toBe(false);
  });
});
