import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';

const FLASH_MS = 320;

/** White flash. Re-triggers every time `token` changes. */
@Component({
  selector: 'app-flash-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="flash" [class.on]="active()" aria-hidden="true"></div>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .flash {
      position: absolute;
      inset: 0;
      background: #fff;
      opacity: 0;
      transition: opacity 260ms ease-out;
    }
    .flash.on {
      opacity: 0.92;
      transition: opacity 40ms ease-in;
    }
  `,
})
export class FlashOverlay {
  readonly token = input(0);
  protected readonly active = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.token() === 0) return;
      this.active.set(true);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.active.set(false), FLASH_MS);
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }
}
