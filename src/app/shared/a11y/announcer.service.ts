import { Injectable, signal } from '@angular/core';

export type Politeness = 'polite' | 'assertive';

/**
 * Pushes short messages to screen readers for state changes that have no focusable
 * UI, such as "They're here" or "Connection interrupted". Rendered by <app-live-region>.
 */
@Injectable({ providedIn: 'root' })
export class Announcer {
  readonly polite = signal('');
  readonly assertive = signal('');

  announce(message: string, politeness: Politeness = 'polite'): void {
    const target = politeness === 'assertive' ? this.assertive : this.polite;
    // Clear first so identical consecutive messages are still announced.
    target.set('');
    setTimeout(() => target.set(message), 50);
  }
}
