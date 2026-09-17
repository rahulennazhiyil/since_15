import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Preferences } from '../../features/profile/preferences';
import { ThemePicker } from '../../features/profile/theme-picker';
import { IconButton } from '../ui/icon-button';
import { Sheet } from '../ui/sheet';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconButton, Sheet, ThemePicker, Preferences],
  template: `
    <div class="bar">
      <a class="brand" routerLink="/" aria-label="since060815 home">since<span>060815</span></a>

      <nav class="links" aria-label="Main">
        <a routerLink="/booth" routerLinkActive="active">Camera</a>
        <a routerLink="/memories" routerLinkActive="active">Memories</a>
        <a routerLink="/activities" routerLinkActive="active">Activities</a>
        <a routerLink="/about" routerLinkActive="active">About</a>
      </nav>

      <div class="actions">
        <button appIconButton icon="sliders" label="Settings" (click)="settingsOpen.set(true)"></button>
      </div>
    </div>

    <app-sheet title="Settings" [(open)]="settingsOpen">
      <!-- Loaded on first open so the settings code stays out of the first paint. -->
      @defer (when settingsOpen()) {
        <p class="eyebrow section">Appearance</p>
        <app-theme-picker />
        <p class="eyebrow section">Photos &amp; sound</p>
        <app-preferences />
      }
    </app-sheet>
  `,
  styles: `
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 50;
      padding-top: var(--safe-top);
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      height: var(--header-h);
      max-width: var(--content-max);
      margin-inline: auto;
      padding-inline: var(--gutter);
    }
    .brand {
      font-weight: 800;
      letter-spacing: -0.02em;
      font-size: var(--text-lg);
    }
    .brand span {
      color: var(--accent-strong);
      font-family: var(--font-display);
      font-style: italic;
      font-weight: 400;
      font-size: 1.25em;
      letter-spacing: 0;
    }
    .links {
      display: none;
      gap: var(--space-1);
      margin-left: var(--space-2);
    }
    .links a {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-pill);
      color: var(--text-muted);
      font-weight: 600;
      font-size: var(--text-sm);
      transition: color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
    }
    .links a:hover,
    .links a.active {
      color: var(--text);
      background: var(--surface-2);
    }
    .actions {
      margin-left: auto;
      display: flex;
      gap: var(--space-1);
    }
    .section {
      margin-block: var(--space-4) var(--space-3);
    }
    .section:first-child {
      margin-top: 0;
    }
    @media (min-width: 900px) {
      .links {
        display: flex;
      }
    }
  `,
})
export class Header {
  protected readonly settingsOpen = signal(false);
}
