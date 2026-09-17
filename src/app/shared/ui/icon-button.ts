import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon, type IconName } from './icon';

export type IconButtonVariant = 'ghost' | 'filled' | 'glass';

/** A 44 px (or 56 px) round button with a required accessible label. */
@Component({
  selector: 'button[appIconButton], a[appIconButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    '[class]': 'classes()',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
  },
  template: `<app-icon [name]="icon()" [size]="iconSize()" />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--tap);
      height: var(--tap);
      border-radius: var(--radius-pill);
      color: var(--text);
      transition:
        background-color var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-out);
    }
    :host(:active) {
      transform: scale(0.94);
    }
    :host(.ib-lg) {
      width: 3.5rem;
      height: 3.5rem;
    }
    :host(.ib-ghost:hover) {
      background: var(--surface-2);
    }
    :host(.ib-filled) {
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }
    :host(.ib-filled:hover) {
      background: var(--surface-2);
    }
    :host(.ib-glass) {
      background: rgb(0 0 0 / 0.35);
      color: #fff;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    :host(.ib-glass:hover) {
      background: rgb(0 0 0 / 0.5);
    }
    :host([disabled]) {
      opacity: 0.5;
      pointer-events: none;
    }
  `,
})
export class IconButton {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly variant = input<IconButtonVariant>('ghost');
  readonly size = input<'md' | 'lg'>('md');

  protected readonly classes = computed(() => `ib ib-${this.variant()} ib-${this.size()}`);
  protected readonly iconSize = computed(() => (this.size() === 'lg' ? 24 : 20));
}
