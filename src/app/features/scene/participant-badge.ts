import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ERROR_COPY } from '../../core/errors/error-copy';
import type { Participant } from '../../core/room/room.model';
import type { PeerState } from '../../core/webrtc/peer-connection.service';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Spinner } from '../../shared/ui/spinner';

/**
 * Sits over the shared scene: the partner's name and mic state, and, while their video
 * is not flowing, a small card that says what is happening.
 */
@Component({
  selector: 'app-participant-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, Spinner],
  template: `
    @if (!connected()) {
      <div class="card">
        <span class="avatar" [style.--c]="participant().color">{{ participant().emoji }}</span>
        <strong>{{ participant().name }}</strong>
        @switch (state()) {
          @case ('failed') {
            <p class="small">{{ failedCopy.message }}</p>
            <button appButton size="sm" variant="secondary" (click)="retry.emit()">{{ failedCopy.action }}</button>
          }
          @case ('disconnected') {
            <app-spinner size="sm" />
            <p class="small">Connection interrupted. Trying again…</p>
          }
          @default {
            <app-spinner size="sm" />
            <p class="small">Connecting…</p>
          }
        }
      </div>
    }
    <div class="chip" aria-hidden="true">
      <span class="emoji">{{ participant().emoji }}</span>
      <span>{{ participant().name }}</span>
      @if (!micOn()) {
        <app-icon name="mic-off" [size]="14" />
      }
    </div>
    @if (!micOn()) {
      <span class="visually-hidden">{{ participant().name }} has their microphone off</span>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      color: #fff;
    }
    .card {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      align-content: center;
      gap: var(--space-2);
      text-align: center;
      padding: var(--space-4);
      background: rgb(28 26 34 / 0.85);
      pointer-events: auto;
      animation: fade-in var(--dur-base) var(--ease-out) both;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      font-size: 2rem;
      background: color-mix(in srgb, var(--c) 22%, #1c1a22);
      border: 2px solid color-mix(in srgb, var(--c) 70%, transparent);
    }
    .card .small {
      color: rgb(255 255 255 / 0.7);
    }
    .chip {
      position: absolute;
      right: var(--space-3);
      top: var(--space-3);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px 4px 6px;
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 0.45);
      font-size: var(--text-xs);
      font-weight: 700;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .chip app-icon {
      color: #f0c060;
    }
  `,
})
export class ParticipantBadge {
  readonly participant = input.required<Participant>();
  readonly state = input<PeerState>('idle');
  readonly hasVideo = input(false);
  readonly micOn = input(true);
  readonly retry = output<void>();

  protected readonly failedCopy = ERROR_COPY['connection-failed'];
  protected readonly connected = computed(() => this.state() === 'connected' && this.hasVideo());
}
