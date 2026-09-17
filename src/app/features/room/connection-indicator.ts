import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { RoomStatus } from '../../core/room/room.model';

const LABELS: Partial<Record<RoomStatus, string>> = {
  looking: 'Finding room',
  waiting: 'Waiting',
  connected: 'Connected',
  disconnected: 'Away',
  reconnecting: 'Reconnecting',
};

/** A quiet dot with a word. Never technical. */
@Component({
  selector: 'app-connection-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', '[attr.aria-label]': "'Connection: ' + label()" },
  template: `<i [class]="'dot ' + status()"></i><span>{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-xs);
      font-weight: 700;
      color: rgb(255 255 255 / 0.85);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #b9b3c0;
    }
    .dot.connected {
      background: #6fbf9a;
    }
    .dot.waiting,
    .dot.looking,
    .dot.reconnecting {
      background: #f0c060;
      animation: pulse-soft 1.6s var(--ease-in-out) infinite;
    }
    .dot.disconnected {
      background: #e57a6a;
    }
    @media (prefers-reduced-motion: reduce) {
      .dot {
        animation: none;
      }
    }
  `,
})
export class ConnectionIndicator {
  readonly status = input.required<RoomStatus>();
  protected readonly label = computed(() => LABELS[this.status()] ?? '');
}
