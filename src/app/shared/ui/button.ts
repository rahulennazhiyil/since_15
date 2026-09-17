import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Applied to native <button> or <a> elements so semantics and keyboard behaviour
 * stay native. Usage: <button appButton variant="primary">Start a Room</button>
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.aria-disabled]': 'loading() || null',
  },
  template: `
    @if (loading()) {
      <app-spinner size="sm" />
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-height: var(--tap);
      padding: 0 var(--space-5);
      border-radius: var(--radius-pill);
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      border: 1px solid transparent;
      transition:
        background-color var(--dur-fast) var(--ease-out),
        color var(--dur-fast) var(--ease-out),
        box-shadow var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-out);
    }
    :host(:active:not([disabled])) {
      transform: scale(0.98);
    }
    :host([disabled]),
    :host([aria-disabled='true']) {
      opacity: 0.55;
      pointer-events: none;
    }
    :host(.btn-sm) {
      min-height: 2.25rem;
      padding: 0 var(--space-4);
      font-size: var(--text-sm);
    }
    :host(.btn-lg) {
      min-height: 3.25rem;
      padding: 0 var(--space-8);
      font-size: var(--text-lg);
    }
    :host(.btn-block) {
      width: 100%;
    }
    :host(.btn-primary) {
      background: var(--accent);
      color: var(--on-accent);
      box-shadow: 0 6px 18px rgb(var(--accent-rgb) / 0.28);
    }
    :host(.btn-primary:hover) {
      background: color-mix(in srgb, var(--accent) 88%, var(--text));
    }
    :host(.btn-secondary) {
      background: var(--surface);
      color: var(--text);
      border-color: var(--border);
      box-shadow: var(--shadow-sm);
    }
    :host(.btn-secondary:hover) {
      background: var(--surface-2);
    }
    :host(.btn-ghost) {
      background: transparent;
      color: var(--text);
    }
    :host(.btn-ghost:hover) {
      background: var(--surface-2);
    }
    :host(.btn-danger) {
      background: var(--danger);
      color: #fff;
    }
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false);
  readonly loading = input(false);

  protected readonly classes = computed(() =>
    ['btn', `btn-${this.variant()}`, `btn-${this.size()}`, this.block() ? 'btn-block' : ''].join(' '),
  );
}
