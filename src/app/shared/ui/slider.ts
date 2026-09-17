import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { uid } from '../utils/id';

/** Labelled range input with a 44 px touch area and a live value readout. */
@Component({
  selector: 'app-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <label [for]="id">{{ label() }}</label>
      <output [for]="id">{{ display() }}</output>
    </div>
    <input
      type="range"
      [id]="id"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [value]="value()"
      [style.--pct.%]="percent()"
      (input)="onInput($event)"
    />
  `,
  styles: `
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      font-size: var(--text-sm);
      margin-bottom: var(--space-1);
    }
    label {
      font-weight: 600;
    }
    output {
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    input {
      width: 100%;
      height: var(--tap);
      margin: 0;
      background: transparent;
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
    }
    input::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 2px;
      background: linear-gradient(to right, var(--accent) var(--pct), var(--surface-2) var(--pct));
    }
    input::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: var(--surface-2);
    }
    input::-moz-range-progress {
      height: 4px;
      border-radius: 2px;
      background: var(--accent);
    }
    input::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      margin-top: -9px;
      border-radius: 50%;
      background: var(--surface);
      border: 2px solid var(--accent);
      box-shadow: var(--shadow-sm);
    }
    input::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--surface);
      border: 2px solid var(--accent);
      box-shadow: var(--shadow-sm);
    }
    input:focus-visible {
      box-shadow: none;
    }
    input:focus-visible::-webkit-slider-thumb {
      box-shadow: var(--focus-ring);
    }
    input:focus-visible::-moz-range-thumb {
      box-shadow: var(--focus-ring);
    }
  `,
})
export class Slider {
  readonly label = input.required<string>();
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly value = model.required<number>();
  /** Optional formatter for the readout, e.g. (v) => v + '%'. */
  readonly format = input<(value: number) => string>((v) => String(v));

  protected readonly id = uid('slider');
  protected readonly display = computed(() => this.format()(this.value()));
  protected readonly percent = computed(() => {
    const span = this.max() - this.min();
    return span === 0 ? 0 : ((this.value() - this.min()) / span) * 100;
  });

  protected onInput(event: Event): void {
    this.value.set(Number((event.target as HTMLInputElement).value));
  }
}
