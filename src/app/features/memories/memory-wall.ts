import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { PhotoStore, type PhotoMeta } from '../../core/storage/photo-store';
import { PhotoThumb } from './photo-thumb';

/** "Our moments": the photos taken in this booth or room visit, newest first. */
@Component({
  selector: 'app-memory-wall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoThumb],
  host: { '[hidden]': 'photos().length === 0' },
  template: `
    <p class="eyebrow">Our moments</p>
    <div class="strip" role="list">
      @for (p of photos(); track p.id) {
        <button type="button" class="item" role="listitem" [attr.aria-label]="'Open photo ' + ($index + 1)" (click)="open.emit(p)">
          <app-photo-thumb [photo]="p" alt="" />
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3) 0 0;
    }
    .eyebrow {
      padding-inline: var(--gutter);
    }
    .strip {
      display: flex;
      gap: var(--space-2);
      overflow-x: auto;
      padding-inline: var(--gutter);
      scrollbar-width: none;
    }
    .strip::-webkit-scrollbar {
      display: none;
    }
    .item {
      flex: none;
      width: 3.5rem;
      height: 3.5rem;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid var(--border);
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .item:hover {
      transform: scale(1.05);
    }
    app-photo-thumb {
      width: 100%;
      height: 100%;
    }
  `,
})
export class MemoryWall {
  readonly sessionId = input.required<string>();
  readonly open = output<PhotoMeta>();

  private readonly store = inject(PhotoStore);
  protected readonly photos = computed(() => this.store.bySession(this.sessionId()));

  constructor() {
    void this.store.load();
  }
}
