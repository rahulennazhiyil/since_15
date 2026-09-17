import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZES: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 36 };

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', '[attr.aria-label]': 'label()' },
  template: `
    <svg [attr.width]="px()" [attr.height]="px()" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.2" stroke-width="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    svg {
      animation: spin 0.9s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      svg {
        animation-duration: 2s;
      }
    }
  `,
})
export class Spinner {
  readonly size = input<SpinnerSize>('md');
  readonly label = input('Loading');
  protected readonly px = computed(() => SIZES[this.size()]);
}
