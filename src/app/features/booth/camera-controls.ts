import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { COUNTDOWN_OPTIONS, type CountdownSeconds } from '../../core/booth/booth-session';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';

/** Bottom control bar: countdown picker, shutter, camera flip. Thumb-sized targets. */
@Component({
  selector: 'app-camera-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton],
  template: `
    <button
      type="button"
      class="pill"
      [attr.aria-label]="'Countdown: ' + countdownLabel() + '. Tap to change.'"
      [disabled]="disabled()"
      (click)="countdownChange.emit(nextCountdown())"
    >
      <app-icon name="timer" [size]="18" />
      <span>{{ countdownLabel() }}</span>
    </button>

    <button
      type="button"
      class="shutter"
      aria-label="Take photo"
      aria-keyshortcuts="Space"
      [disabled]="disabled()"
      (click)="shutter.emit()"
    >
      <span></span>
    </button>

    <button
      appIconButton
      icon="flip"
      label="Switch camera"
      variant="glass"
      size="lg"
      [disabled]="disabled() || !canFlip()"
      [style.visibility]="canFlip() ? 'visible' : 'hidden'"
      (click)="flip.emit()"
    ></button>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      justify-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--gutter) calc(var(--space-5) + var(--safe-bottom));
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--tap);
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 0.35);
      color: #fff;
      font-weight: 700;
      font-size: var(--text-sm);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      justify-self: end;
    }
    .pill:disabled,
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
    :host ::ng-deep [appIconButton] {
      justify-self: start;
    }
  `,
})
export class CameraControls {
  readonly countdown = input.required<CountdownSeconds>();
  readonly canFlip = input(false);
  readonly disabled = input(false);

  readonly shutter = output<void>();
  readonly flip = output<void>();
  readonly countdownChange = output<CountdownSeconds>();

  protected readonly countdownLabel = computed(
    () => COUNTDOWN_OPTIONS.find((o) => o.value === this.countdown())?.label ?? 'Off',
  );

  protected nextCountdown(): CountdownSeconds {
    const idx = COUNTDOWN_OPTIONS.findIndex((o) => o.value === this.countdown());
    return COUNTDOWN_OPTIONS[(idx + 1) % COUNTDOWN_OPTIONS.length].value;
  }
}
