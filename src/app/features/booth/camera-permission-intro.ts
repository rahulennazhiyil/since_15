import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AppError } from '../../core/errors/app-error';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';

/** Explains why we need the camera before the browser prompt appears. Also the error state. */
@Component({
  selector: 'app-camera-permission-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, RouterLink],
  template: `
    <div class="box motion-rise">
      <span class="mark" [class.error]="error()">
        <app-icon [name]="error() ? 'warning' : 'camera'" [size]="28" />
      </span>

      @if (error(); as err) {
        <h1 class="title">{{ err.userMessage.title }}</h1>
        <p class="lead">{{ err.userMessage.message }}</p>
      } @else {
        <h1 class="title">Let's turn on your camera</h1>
        <p class="lead">Your camera stays in your browser. Nothing is recorded or uploaded.</p>
      }

      <button appButton size="lg" [loading]="starting()" (click)="start.emit()">
        {{ buttonLabel() }}
      </button>
      <a class="small muted" routerLink="/privacy">How we handle your camera</a>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      flex: 1;
      padding: var(--space-8) var(--gutter);
    }
    .box {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      max-width: 26rem;
      text-align: center;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent-strong);
      margin-bottom: var(--space-2);
    }
    .mark.error {
      background: color-mix(in srgb, var(--danger) 14%, transparent);
      color: var(--danger);
    }
    a {
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  `,
})
export class CameraPermissionIntro {
  readonly error = input<AppError | null>(null);
  readonly starting = input(false);
  readonly start = output<void>();

  protected readonly buttonLabel = computed(() => {
    const err = this.error();
    if (!err) return 'Turn on camera';
    return err.userMessage.action ?? 'Try again';
  });
}
