import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { COUNTDOWN_OPTIONS, type CountdownSeconds } from '../../core/booth/booth-session';
import type { PhotoMeta } from '../../core/storage/photo-store';
import { Icon } from '../../shared/ui/icon';
import { PhotoThumb } from '../memories/photo-thumb';

/**
 * Bottom control bar, laid out like a camera app: extra actions and the timer on the
 * left, the shutter in the middle, the latest photo and camera flip on the right. Pages
 * project their own round buttons into `slot="left"` / `slot="right"`. Every target is a
 * round glass button of the same size; the timer shows its seconds as a badge, so nothing
 * wraps on narrow phones.
 */
@Component({
  selector: 'app-camera-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, PhotoThumb],
  template: `
    <div class="side left">
      <ng-content select="[slot=left]" />
      @if (showBackground()) {
        <button type="button" class="round" [class.active]="backgroundActive()" aria-label="Background" [disabled]="disabled()" (click)="background.emit()">
          <app-icon name="image" [size]="22" />
        </button>
      }
      <button
        type="button"
        class="round"
        [class.active]="countdown() !== 0"
        [attr.aria-label]="'Countdown: ' + countdownLabel() + '. Tap to change.'"
        [disabled]="disabled()"
        (click)="countdownChange.emit(nextCountdown())"
      >
        <app-icon name="timer" [size]="22" />
        <span class="badge">{{ countdownLabel() }}</span>
      </button>
    </div>

    <button type="button" class="shutter" aria-label="Take photo" aria-keyshortcuts="Space" [disabled]="disabled()" (click)="shutter.emit()">
      <span></span>
    </button>

    <div class="side right">
      @if (lastPhoto(); as photo) {
        <button type="button" class="round gallery" aria-label="Open your latest photo" (click)="gallery.emit(photo)">
          <app-photo-thumb [photo]="photo" alt="" />
        </button>
      } @else {
        <span class="round placeholder" aria-hidden="true"></span>
      }
      @if (canFlip()) {
        <button type="button" class="round" aria-label="Switch camera" [disabled]="disabled()" (click)="flip.emit()">
          <app-icon name="flip" [size]="22" />
        </button>
      }
      <ng-content select="[slot=right]" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--gutter) calc(var(--space-4) + var(--safe-bottom));
    }
    .side {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }
    .side.left {
      justify-content: flex-end;
    }
    .side.right {
      justify-content: flex-start;
    }
    .round,
    .side ::ng-deep [appIconButton] {
      position: relative;
      display: grid;
      place-items: center;
      flex: none;
      width: var(--tap);
      height: var(--tap);
      border-radius: 50%;
      background: rgb(0 0 0 / 0.38);
      color: #fff;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
    }
    .round:active {
      transform: scale(0.94);
    }
    .active {
      box-shadow: 0 0 0 2px var(--accent);
    }
    .badge {
      position: absolute;
      right: -5px;
      bottom: -4px;
      min-width: 1.3rem;
      padding: 1px 5px;
      border-radius: var(--radius-pill);
      background: var(--accent);
      color: var(--on-accent);
      font-size: 0.62rem;
      font-weight: 800;
      line-height: 1.3;
      text-align: center;
    }
    .gallery {
      overflow: hidden;
      border: 2px solid rgb(255 255 255 / 0.85);
      background: #000;
    }
    .gallery app-photo-thumb {
      width: 100%;
      height: 100%;
    }
    .placeholder {
      visibility: hidden;
    }
    .round:disabled,
    .shutter:disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .shutter {
      display: grid;
      place-items: center;
      width: var(--shutter);
      height: var(--shutter);
      border-radius: 50%;
      border: 4px solid #fff;
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .shutter span {
      width: calc(var(--shutter) - 16px);
      height: calc(var(--shutter) - 16px);
      border-radius: 50%;
      background: #fff;
      transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
    }
    .shutter:hover span {
      background: var(--accent);
    }
    .shutter:active span {
      transform: scale(0.86);
    }
  `,
})
export class CameraControls {
  readonly countdown = input.required<CountdownSeconds>();
  readonly canFlip = input(false);
  readonly disabled = input(false);
  /** Shows the background picker button (hidden when the device cannot cut people out). */
  readonly showBackground = input(false);
  readonly backgroundActive = input(false);
  /** Newest photo of this visit, shown as a small round thumbnail next to the shutter. */
  readonly lastPhoto = input<PhotoMeta | null>(null);

  readonly shutter = output<void>();
  readonly flip = output<void>();
  readonly background = output<void>();
  readonly gallery = output<PhotoMeta>();
  readonly countdownChange = output<CountdownSeconds>();

  protected readonly countdownLabel = computed(() => COUNTDOWN_OPTIONS.find((o) => o.value === this.countdown())?.label ?? 'Off');

  protected nextCountdown(): CountdownSeconds {
    const idx = COUNTDOWN_OPTIONS.findIndex((o) => o.value === this.countdown());
    return COUNTDOWN_OPTIONS[(idx + 1) % COUNTDOWN_OPTIONS.length].value;
  }
}
