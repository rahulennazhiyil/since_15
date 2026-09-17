import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhotoStore, type PhotoMeta } from '../../core/storage/photo-store';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Spinner } from '../../shared/ui/spinner';
import { PhotoThumb } from './photo-thumb';
import { PhotoViewer } from './photo-viewer';

interface DayGroup {
  label: string;
  photos: PhotoMeta[];
}

function dayLabel(ts: number, now = new Date()): string {
  const d = new Date(ts);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

@Component({
  selector: 'app-memories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, RouterLink, Button, Icon, Spinner, PhotoThumb, PhotoViewer],
  template: `
    <app-page-shell>
      <header class="head">
        <div>
          <p class="eyebrow">Memories</p>
          <h1 class="title-lg">Your photos</h1>
        </div>
        <p class="small muted">Stored in this browser only</p>
      </header>

      @if (!store.loaded()) {
        <div class="center" style="padding-block: var(--space-12)"><app-spinner size="lg" /></div>
      } @else if (store.photos().length === 0) {
        <div class="empty card motion-rise">
          <span class="mark"><app-icon name="images" [size]="26" /></span>
          <h2 class="title">No moments yet</h2>
          <p class="muted">Photos you take in the booth or a room land here automatically, and never leave your device.</p>
          <div class="cluster">
            <a appButton routerLink="/room/new">Start a room</a>
            <a appButton variant="ghost" routerLink="/booth">Open the camera</a>
          </div>
        </div>
      } @else {
        @for (group of groups(); track group.label) {
          <section class="group">
            <h2 class="eyebrow">{{ group.label }}</h2>
            <ul class="grid">
              @for (p of group.photos; track p.id) {
                <li>
                  <button type="button" class="cell" [class.tall]="p.height > p.width * 1.3" [attr.aria-label]="'Open photo from ' + group.label" (click)="viewing.set(p)">
                    <app-photo-thumb [photo]="p" alt="" />
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      }
    </app-page-shell>

    @if (viewing(); as p) {
      <app-photo-viewer [photo]="p" (closed)="viewing.set(null)" />
    }
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }
    .empty {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
      padding: var(--space-10) var(--space-6);
      text-align: center;
      max-width: 32rem;
      margin-inline: auto;
    }
    .empty .cluster {
      justify-content: center;
      margin-top: var(--space-2);
    }
    .mark {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    .group + .group {
      margin-top: var(--space-8);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
      grid-auto-rows: 7.5rem;
      grid-auto-flow: dense;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }
    .cell {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--border);
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .cell:hover {
      transform: scale(1.02);
    }
    li:has(.tall) {
      grid-row: span 2;
    }
    app-photo-thumb {
      width: 100%;
      height: 100%;
    }
  `,
})
export class MemoriesPage {
  protected readonly store = inject(PhotoStore);
  protected readonly viewing = signal<PhotoMeta | null>(null);

  protected readonly groups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const p of this.store.photos()) {
      const label = dayLabel(p.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.photos.push(p);
      else groups.push({ label, photos: [p] });
    }
    return groups;
  });

  constructor() {
    void this.store.load();
  }
}
