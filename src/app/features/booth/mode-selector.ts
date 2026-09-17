import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BOOTH_MODES, type BoothMode } from '../../core/booth/booth-session';
import { Segmented, type SegmentOption } from '../../shared/ui/segmented';

@Component({
  selector: 'app-mode-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Segmented],
  template: `
    <app-segmented
      label="Photo mode"
      [options]="options"
      [value]="mode()"
      (valueChange)="modeChange.emit($event)"
      [class.disabled]="disabled()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .disabled {
      pointer-events: none;
      opacity: 0.6;
    }
  `,
})
export class ModeSelector {
  readonly mode = input.required<BoothMode>();
  readonly disabled = input(false);
  readonly modeChange = output<BoothMode>();

  protected readonly options: readonly SegmentOption<BoothMode>[] = BOOTH_MODES.map((m) => ({
    value: m.value,
    label: m.label,
  }));
}
