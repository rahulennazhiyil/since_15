import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { ToastService } from './toast.service';

/** Renders the toast stack. Place once in the app shell. */
@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton],
  host: { 'aria-live': 'polite', 'aria-atomic': 'false' },
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [class]="'toast ' + toast.kind" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
        <app-icon [name]="toast.kind === 'error' ? 'warning' : toast.kind === 'success' ? 'check' : 'info'" />
        <div class="text">
          @if (toast.title) {
            <strong>{{ toast.title }}</strong>
          }
          <span>{{ toast.message }}</span>
        </div>
        <button appIconButton icon="close" label="Dismiss" (click)="toasts.dismiss(toast.id)"></button>
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      left: 50%;
      bottom: calc(var(--bottom-bar-h) + var(--safe-bottom) + var(--space-4));
      transform: translateX(-50%);
      z-index: 90;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: min(28rem, calc(100vw - 2rem));
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      animation: rise-in var(--dur-base) var(--ease-out) both;
    }
    .toast > app-icon {
      margin-top: 2px;
      color: var(--text-muted);
    }
    .toast.error > app-icon {
      color: var(--danger);
    }
    .toast.success > app-icon {
      color: var(--accent-strong);
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--text-sm);
      padding-top: 6px;
    }
    @media (min-width: 900px) {
      :host {
        bottom: var(--space-6);
      }
    }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
