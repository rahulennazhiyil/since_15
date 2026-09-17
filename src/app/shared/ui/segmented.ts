import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** A radio-group style control for 2 to 5 mutually exclusive options. */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    @for (opt of options(); track opt.value) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="opt.value === value()"
        [tabindex]="opt.value === value() ? 0 : -1"
        [class.active]="opt.value === value()"
        (click)="value.set(opt.value)"
      >
        {{ opt.label }}
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      padding: 4px;
      gap: 2px;
      border-radius: var(--radius-pill);
      background: var(--surface-2);
    }
    button {
      min-height: 2.25rem;
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-muted);
      transition:
        background-color var(--dur-fast) var(--ease-out),
        color var(--dur-fast) var(--ease-out),
        box-shadow var(--dur-fast) var(--ease-out);
    }
    button.active {
      background: var(--surface);
      color: var(--text);
      box-shadow: var(--shadow-sm);
    }
  `,
})
export class Segmented<T extends string | number> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly label = input.required<string>();
  readonly value = model.required<T>();

  protected onKeydown(event: KeyboardEvent): void {
    const dir = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const opts = this.options();
    const idx = opts.findIndex((o) => o.value === this.value());
    const next = opts[(idx + dir + opts.length) % opts.length];
    this.value.set(next.value);
    const host = event.currentTarget as HTMLElement;
    host.querySelectorAll<HTMLButtonElement>('button')[opts.indexOf(next)]?.focus();
  }
}
