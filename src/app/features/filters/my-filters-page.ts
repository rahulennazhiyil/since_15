import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toAppError } from '../../core/errors/app-error';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { sampleFrame } from '../../core/filters/sample-frame';
import { CustomFilterStore } from '../../core/storage/custom-filter-store';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Sheet } from '../../shared/ui/sheet';
import { Spinner } from '../../shared/ui/spinner';
import { ToastService } from '../../shared/ui/toast.service';
import { FilterThumbnail } from './filter-thumbnail';

@Component({
  selector: 'app-my-filters-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, RouterLink, Button, Icon, IconButton, Sheet, Spinner, FilterThumbnail],
  template: `
    <app-page-shell>
      <header class="head">
        <div>
          <p class="eyebrow">Filters</p>
          <h1 class="title-lg">My filters</h1>
        </div>
        <a appButton routerLink="/filters/new"><app-icon name="plus" [size]="18" /> Create filter</a>
      </header>

      @if (!store.loaded()) {
        <div class="center" style="padding-block: var(--space-12)"><app-spinner size="lg" /></div>
      } @else if (store.filters().length === 0) {
        <div class="empty card motion-rise">
          <span class="mark"><app-icon name="sparkles" [size]="26" /></span>
          <h2 class="title">Nothing here yet</h2>
          <p class="muted">Build a look from scratch or start from one of ours, then use it in the booth like any other filter.</p>
          <div class="cluster">
            <a appButton routerLink="/filters/new">Create your first filter</a>
            <a appButton variant="ghost" routerLink="/booth">Open the camera</a>
          </div>
        </div>
      } @else {
        <ul class="grid">
          @for (f of store.filters(); track f.id) {
            <li class="card item motion-rise">
              <a class="thumb" [routerLink]="['/filters', f.id]" [attr.aria-label]="'Edit ' + f.name">
                <app-filter-thumbnail [source]="sample()" [filter]="f" [size]="160" />
              </a>
              <div class="meta">
                <strong>{{ f.name }}</strong>
                <span class="small muted">{{ f.overlays.length }} sticker{{ f.overlays.length === 1 ? '' : 's' }}</span>
              </div>
              <div class="actions">
                <a appIconButton icon="pencil" label="Edit" [routerLink]="['/filters', f.id]"></a>
                <a appIconButton icon="copy" label="Duplicate" routerLink="/filters/new" [queryParams]="{ from: f.id }"></a>
                <button appIconButton icon="trash" label="Delete" (click)="pendingDelete.set(f)"></button>
              </div>
            </li>
          }
        </ul>
      }
    </app-page-shell>

    <app-sheet title="Delete this filter?" [open]="pendingDelete() !== null" (openChange)="$event || pendingDelete.set(null)">
      <p class="muted" style="margin-bottom: var(--space-5)">
        “{{ pendingDelete()?.name }}” will be removed from your list. Photos you already took keep their look.
      </p>
      <div class="cluster" style="justify-content: flex-end">
        <button appButton variant="ghost" (click)="pendingDelete.set(null)">Keep it</button>
        <button appButton variant="danger" (click)="remove()">Delete</button>
      </div>
    </app-sheet>
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
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: var(--space-4);
    }
    .item {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-3);
    }
    .thumb {
      display: block;
      aspect-ratio: 1;
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .thumb app-filter-thumbnail {
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }
    .meta {
      display: grid;
      padding-inline: var(--space-1);
      line-height: 1.3;
    }
    .actions {
      display: flex;
      justify-content: space-between;
    }
  `,
})
export class MyFiltersPage {
  protected readonly store = inject(CustomFilterStore);
  private readonly toast = inject(ToastService);

  protected readonly sample = signal<ImageBitmap | null>(null);
  protected readonly pendingDelete = signal<FilterDefinition | null>(null);

  constructor() {
    void this.store.load();
    void sampleFrame().then((b) => this.sample.set(b));
  }

  protected async remove(): Promise<void> {
    const target = this.pendingDelete();
    if (!target) return;
    try {
      await this.store.remove(target.id);
      this.toast.show(`“${target.name}” deleted`);
    } catch (error) {
      this.toast.error(toAppError(error, 'storage-failed'));
    } finally {
      this.pendingDelete.set(null);
    }
  }
}
