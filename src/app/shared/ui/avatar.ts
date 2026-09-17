import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

/** Emoji-on-colour identity mark used for participants. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'name()',
    '[class]': "'avatar ' + size()",
    '[style.--avatar-color]': 'color()',
  },
  template: `<span aria-hidden="true">{{ emoji() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--avatar-color) 22%, var(--surface));
      border: 2px solid color-mix(in srgb, var(--avatar-color) 70%, transparent);
      line-height: 1;
    }
    :host(.sm) {
      width: 2rem;
      height: 2rem;
      font-size: 1rem;
    }
    :host(.md) {
      width: 2.75rem;
      height: 2.75rem;
      font-size: 1.375rem;
    }
    :host(.lg) {
      width: 4rem;
      height: 4rem;
      font-size: 2rem;
    }
  `,
})
export class Avatar {
  readonly emoji = input.required<string>();
  readonly color = input.required<string>();
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('md');
}
