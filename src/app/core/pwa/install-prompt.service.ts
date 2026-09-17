import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Captures the browser's install prompt so we can offer "Install" from Settings at a
 * calm moment instead of interrupting the camera. Browsers without the event simply
 * never show the button.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private deferred: BeforeInstallPromptEvent | null = null;
  private readonly _available = signal(false);
  private readonly _installed = signal(false);

  readonly available = this._available.asReadonly();
  readonly installed = this._installed.asReadonly();

  constructor() {
    const win = inject(DOCUMENT).defaultView;
    if (!win) return;
    win.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this._available.set(true);
    });
    win.addEventListener('appinstalled', () => {
      this.deferred = null;
      this._available.set(false);
      this._installed.set(true);
    });
    if (win.matchMedia?.('(display-mode: standalone)').matches) this._installed.set(true);
  }

  async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = this.deferred;
    if (!event) return 'unavailable';
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') {
      this.deferred = null;
      this._available.set(false);
    }
    return outcome;
  }
}
