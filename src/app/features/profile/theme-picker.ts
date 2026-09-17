import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfileService } from '../../core/profile/profile.service';
import { THEMES } from '../../core/profile/profile.model';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-theme-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { role: 'radiogroup', 'aria-label': 'Theme' },
  template: `
    @for (theme of themes; track theme.id) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="theme.id === profile.theme()"
        [class.active]="theme.id === profile.theme()"
        (click)="profile.setTheme(theme.id)"
      >
        <span class="swatch" [attr.data-theme]="theme.id" aria-hidden="true">
          <span class="dot"></span>
          <span class="line"></span>
        </span>
        <span class="text">
          <strong>{{ theme.name }}</strong>
          <small>{{ theme.description }}</small>
        </span>
        @if (theme.id === profile.theme()) {
          <app-icon name="check" [size]="18" />
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
    }
    button {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      min-height: 3.5rem;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      text-align: left;
      transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    button:hover {
      background: var(--surface-2);
    }
    button.active {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .swatch {
      position: relative;
      flex: none;
      width: 3rem;
      height: 2.5rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      overflow: hidden;
    }
    .swatch[data-theme='soft'] { background: #fbf7f2; --sw-accent: #d98a9c; --sw-text: #2b2622; }
    .swatch[data-theme='night'] { background: #17151c; --sw-accent: #b79ce8; --sw-text: #f2eef7; }
    .swatch[data-theme='film'] { background: #efe6d8; --sw-accent: #1a1714; --sw-text: #1a1714; }
    .swatch[data-theme='dream'] { background: #f4f1fb; --sw-accent: #9d8ae6; --sw-text: #2a2540; }
    .dot {
      position: absolute;
      left: 8px;
      top: 8px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .line {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 9px;
      height: 4px;
      border-radius: 2px;
      background: var(--sw-text);
      opacity: 0.35;
    }
    .text {
      display: flex;
      flex-direction: column;
      flex: 1;
      line-height: 1.25;
    }
    small {
      color: var(--text-muted);
      font-size: var(--text-xs);
    }
    app-icon {
      color: var(--accent-strong);
    }
  `,
})
export class ThemePicker {
  protected readonly profile = inject(ProfileService);
  protected readonly themes = THEMES;
}
