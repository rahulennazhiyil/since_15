import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '../../shared/ui/button';

/** Big centred number; each value is a fresh element so the pop animation replays. */
@Component({
  selector: 'app-countdown-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  host: { role: 'status', 'aria-live': 'assertive', 'aria-atomic': 'true' },
  template: `
    @if (value(); as v) {
      <div class="veil">
        <p class="hint">{{ hint() }}</p>
        <!-- Alternating animation names restart the pop on every new value without re-creating DOM. -->
        <span class="number" [class.odd]="v % 2 === 1" [class.even]="v % 2 === 0">{{ v }}</span>
        <button appButton variant="ghost" size="sm" class="cancel" (click)="cancel.emit()">Cancel</button>
      </div>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .veil {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--space-4);
      background: rgb(0 0 0 / 0.18);
      pointer-events: auto;
      animation: fade-in var(--dur-base) var(--ease-out) both;
    }
    .hint {
      color: rgb(255 255 255 / 0.85);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: var(--text-sm);
    }
    .number {
      font-family: var(--font-display);
      font-style: italic;
      font-size: clamp(6rem, 28vmin, 12rem);
      line-height: 1;
      color: #fff;
      text-shadow: 0 8px 40px rgb(0 0 0 / 0.35);
      animation: pop-a var(--dur-slow) var(--ease-out) both;
    }
    .number.even {
      animation-name: pop-b;
    }
    .cancel {
      color: #fff;
      background: rgb(0 0 0 / 0.3);
    }
    @keyframes pop-a {
      from {
        opacity: 0;
        transform: scale(1.4);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes pop-b {
      from {
        opacity: 0;
        transform: scale(1.4);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,
})
export class CountdownOverlay {
  readonly value = input.required<number | null>();
  readonly hint = input('Get ready');
  readonly cancel = output<void>();
}
