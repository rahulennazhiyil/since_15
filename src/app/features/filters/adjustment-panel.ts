import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ADJUSTMENT_RANGES, type FilterDraft } from '../../core/filters/filter-draft';
import type { Adjustments } from '../../core/filters/filter.model';
import { Button } from '../../shared/ui/button';
import { Slider } from '../../shared/ui/slider';

interface Control {
  key: keyof Adjustments;
  label: string;
  format: (v: number) => string;
}

const signedPercent = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;
const relPercent = (v: number) => signedPercent(v - 1);
const percent = (v: number) => `${Math.round(v * 100)}`;

const CONTROLS: Record<keyof Adjustments, Control> = {
  brightness: { key: 'brightness', label: 'Brightness', format: relPercent },
  contrast: { key: 'contrast', label: 'Contrast', format: relPercent },
  exposure: { key: 'exposure', label: 'Exposure', format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}` },
  fade: { key: 'fade', label: 'Fade', format: percent },
  shadows: { key: 'shadows', label: 'Shadows', format: percent },
  highlights: { key: 'highlights', label: 'Highlights', format: percent },
  blur: { key: 'blur', label: 'Blur', format: (v) => `${v.toFixed(1)} px` },
  sharpen: { key: 'sharpen', label: 'Sharpen', format: percent },
  saturation: { key: 'saturation', label: 'Color', format: relPercent },
  temperature: { key: 'temperature', label: 'Temperature', format: signedPercent },
  tint: { key: 'tint', label: 'Tint', format: signedPercent },
  hue: { key: 'hue', label: 'Hue', format: (v) => `${Math.round(v)}°` },
  sepia: { key: 'sepia', label: 'Sepia', format: percent },
};

/** A column of sliders for a chosen subset of adjustments, bound to a FilterDraft. */
@Component({
  selector: 'app-adjustment-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Slider, Button],
  template: `
    @for (c of controls(); track c.key) {
      <app-slider
        [label]="c.label"
        [min]="ranges[c.key].min"
        [max]="ranges[c.key].max"
        [step]="ranges[c.key].step"
        [value]="draft().adjustments()[c.key]"
        [format]="c.format"
        (valueChange)="draft().setAdjustment(c.key, $event)"
      />
    }
    <button appButton variant="ghost" size="sm" class="reset" (click)="draft().resetAdjustments()">Reset adjustments</button>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }
    .reset {
      justify-self: end;
      color: var(--text-muted);
    }
  `,
})
export class AdjustmentPanel {
  readonly draft = input.required<FilterDraft>();
  readonly keys = input.required<(keyof Adjustments)[]>();

  protected readonly ranges = ADJUSTMENT_RANGES;
  protected controls(): Control[] {
    return this.keys().map((k) => CONTROLS[k]);
  }
}
