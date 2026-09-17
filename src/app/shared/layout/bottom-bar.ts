import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon, type IconName } from '../ui/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
}

const ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Home', icon: 'home', exact: true },
  { path: '/booth', label: 'Camera', icon: 'camera', exact: false },
  { path: '/memories', label: 'Memories', icon: 'images', exact: false },
  { path: '/activities', label: 'Activities', icon: 'sparkles', exact: false },
];

/** Thumb-reachable navigation for phones. Hidden on wide screens. */
@Component({
  selector: 'app-bottom-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  template: `
    <nav aria-label="Primary">
      @for (item of items; track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.exact }"
          ariaCurrentWhenActive="page"
        >
          <app-icon [name]="item.icon" [size]="22" />
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    :host {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 50;
      padding-bottom: var(--safe-bottom);
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
    }
    nav {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      height: var(--bottom-bar-h);
    }
    a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--text-muted);
      font-size: 0.6875rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      transition: color var(--dur-fast) var(--ease-out);
    }
    a.active {
      color: var(--accent-strong);
    }
    @media (min-width: 900px) {
      :host {
        display: none;
      }
    }
  `,
})
export class BottomBar {
  protected readonly items = ITEMS;
}
