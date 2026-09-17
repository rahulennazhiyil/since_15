import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ShareInvite } from './share-invite';

/** The host's empty room: quiet, a little hopeful, and easy to share. */
@Component({
  selector: 'app-room-waiting',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShareInvite],
  template: `
    <div class="box motion-rise">
      <p class="title">Waiting for your person<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>
      <p class="lead">Send them this link <span aria-hidden="true">❤️</span></p>
      <app-share-invite [code]="code()" />
      <p class="small muted">The room closes by itself if nobody joins for a while.</p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      padding: var(--space-6) var(--gutter);
    }
    .box {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      text-align: center;
      max-width: 26rem;
    }
    .title {
      color: #fff;
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-2xl);
    }
    .lead {
      color: rgb(255 255 255 / 0.75);
    }
    .dots {
      display: inline-flex;
      gap: 3px;
      margin-left: 4px;
    }
    .dots i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.4;
    }
    @media (prefers-reduced-motion: no-preference) {
      .dots i {
        animation: pulse-soft 1.4s var(--ease-in-out) infinite;
      }
      .dots i:nth-child(2) {
        animation-delay: 0.2s;
      }
      .dots i:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  `,
})
export class RoomWaiting {
  readonly code = input.required<string>();
}
