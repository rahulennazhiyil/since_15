import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StorageService, type StorageKeyDef } from '../../../core/storage/storage.service';
import { Button } from '../../../shared/ui/button';
import { Icon } from '../../../shared/ui/icon';
import { IconButton } from '../../../shared/ui/icon-button';
import { uid } from '../../../shared/utils/id';
import { ActivityChannel, isAsk, type AskPayload } from '../activity-channel';
import { mergeBucketLists, type BucketItem } from '../activity-logic';

/** Removed items stay as tombstones so a partner's older copy cannot resurrect them. */
interface StoredItem extends BucketItem {
  removed?: boolean;
}

interface ListPayload {
  items: StoredItem[];
}
type Payload = ListPayload | AskPayload;

const STORAGE: StorageKeyDef<StoredItem[]> = { key: 'bucket-list', version: 1, defaults: () => [] };
const MAX_TEXT = 80;

const isPayload = (v: unknown): v is Payload =>
  isAsk(v) ||
  (Array.isArray((v as ListPayload)?.items) &&
    (v as ListPayload).items.every((i) => typeof i.id === 'string' && typeof i.text === 'string' && typeof i.done === 'boolean' && typeof i.updatedAt === 'number'));

/** Kept on both devices; the two lists merge whenever the pair connects. */
@Component({
  selector: 'app-bucket-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, IconButton],
  template: `
    <form class="add" (submit)="add($event)">
      <input type="text" placeholder="Something we'll do together…" [value]="text()" [attr.maxlength]="maxText" aria-label="New item" (input)="text.set($any($event.target).value)" />
      <button appButton size="sm" type="submit" [disabled]="!text().trim()"><app-icon name="plus" [size]="16" /> Add</button>
    </form>

    @if (visible().length === 0) {
      <p class="small muted">Start with one thing. Visit Japan? Watch a sunrise? Cook the same dish in two kitchens?</p>
    }
    <ul class="list">
      @for (item of visible(); track item.id) {
        <li [class.done]="item.done">
          <button type="button" class="check" role="checkbox" [attr.aria-checked]="item.done" [attr.aria-label]="item.text" (click)="toggle(item)">
            @if (item.done) {
              <app-icon name="check" [size]="16" />
            }
          </button>
          <span class="text">{{ item.text }}</span>
          <button appIconButton icon="trash" label="Remove" (click)="remove(item)"></button>
        </li>
      }
    </ul>
    <p class="small muted">{{ doneCount() }} of {{ visible().length }} done · saved on this device{{ channel.connected() ? ' and shared live' : '' }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }
    .add {
      display: flex;
      gap: var(--space-2);
    }
    .add input {
      flex: 1;
      min-width: 0;
      min-height: var(--tap);
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
    }
    .list {
      display: grid;
      gap: var(--space-1);
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: var(--tap);
      padding-left: var(--space-1);
      border-radius: var(--radius-md);
    }
    .check {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      border: 2px solid var(--accent);
      color: var(--on-accent);
      flex: none;
    }
    li.done .check {
      background: var(--accent);
    }
    .text {
      flex: 1;
      font-weight: 600;
    }
    li.done .text {
      color: var(--text-muted);
      text-decoration: line-through;
    }
  `,
})
export class BucketList {
  protected readonly channel = inject(ActivityChannel);
  private readonly storage = inject(StorageService);

  protected readonly maxText = MAX_TEXT;
  protected readonly text = signal('');
  private readonly items = signal<StoredItem[]>(this.storage.read(STORAGE));
  protected readonly visible = computed(() => this.items().filter((i) => !i.removed));
  protected readonly doneCount = computed(() => this.visible().filter((i) => i.done).length);

  constructor() {
    effect(() => this.storage.write(STORAGE, this.items()));
    // Offer our list whenever a partner connects; they answer with theirs and both merge.
    effect(() => {
      if (this.channel.connected()) untracked(() => this.share());
    });
    this.channel
      .on('bucket-list', isPayload)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((p) => {
        if (isAsk(p)) {
          this.share();
          return;
        }
        const merged = mergeBucketLists(this.items(), p.items) as StoredItem[];
        this.items.set(merged);
        // Reply when we hold anything they do not, so both sides converge.
        const theirs = JSON.stringify(mergeBucketLists(p.items, []));
        if (JSON.stringify(mergeBucketLists(merged, [])) !== theirs) this.share();
      });
  }

  protected add(event: Event): void {
    event.preventDefault();
    const text = this.text().trim();
    if (!text) return;
    this.items.update((list) => [...list, { id: uid('item'), text, done: false, updatedAt: Date.now() }]);
    this.text.set('');
    this.share();
  }

  protected toggle(item: StoredItem): void {
    this.patch(item.id, { done: !item.done });
  }

  protected remove(item: StoredItem): void {
    this.patch(item.id, { removed: true });
  }

  private patch(id: string, changes: Partial<StoredItem>): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...changes, updatedAt: Date.now() } : i)));
    this.share();
  }

  private share(): void {
    this.channel.send('bucket-list', { items: this.items() } satisfies ListPayload);
  }
}
