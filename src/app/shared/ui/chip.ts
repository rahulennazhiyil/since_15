import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A pill toggle, used for categories and small option sets. */
@Component({
  selector: 'button[appChip]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-pressed]': 'selected()',
    '[class.selected]': 'selected()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 2.25rem;
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: 600;
      white-space: nowrap;
      transition:
        background-color var(--dur-fast) var(--ease-out),
        color var(--dur-fast) var(--ease-out);
    }
    :host(:hover) {
      color: var(--text);
    }
    :host(.selected) {
      background: var(--text);
      color: var(--bg);
    }
  `,
})
export class Chip {
  readonly selected = input(false);
}
