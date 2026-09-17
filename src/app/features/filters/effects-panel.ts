import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EFFECT_RANGE, type FilterDraft, type NumericEffect } from '../../core/filters/filter-draft';
import { Button } from '../../shared/ui/button';
import { Slider } from '../../shared/ui/slider';
import { Switch } from '../../shared/ui/switch';

const EFFECTS: { key: NumericEffect; label: string }[] = [
  { key: 'grain', label: 'Film grain' },
  { key: 'vignette', label: 'Vignette' },
  { key: 'glow', label: 'Glow' },
  { key: 'lightLeak', label: 'Light leak' },
  { key: 'pixelate', label: 'Pixelate' },
  { key: 'vhs', label: 'VHS' },
];

@Component({
  selector: 'app-effects-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Slider, Button, Switch],
  template: `
    @for (e of effects; track e.key) {
      <app-slider
        [label]="e.label"
        [min]="range.min"
        [max]="range.max"
        [step]="range.step"
        [value]="draft().effects()[e.key]"
        [format]="percent"
        (valueChange)="draft().setEffect(e.key, $event)"
      />
    }
    <app-switch label="Date stamp" [checked]="draft().effects().dateStamp" (checkedChange)="draft().setDateStamp($event)" />
    <button appButton variant="ghost" size="sm" class="reset" (click)="draft().resetEffects()">Reset effects</button>
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
export class EffectsPanel {
  readonly draft = input.required<FilterDraft>();
  protected readonly effects = EFFECTS;
  protected readonly range = EFFECT_RANGE;
  protected readonly percent = (v: number) => `${Math.round(v * 100)}`;
}
