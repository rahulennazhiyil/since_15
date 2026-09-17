import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FILTER_CATEGORIES,
  type FilterCategory,
  type FilterDefinition,
} from '../../core/filters/filter.model';
import { RouterLink } from '@angular/router';
import { Chip } from '../../shared/ui/chip';
import { Icon } from '../../shared/ui/icon';
import { FilterThumbnail } from './filter-thumbnail';

/**
 * Horizontal, swipeable filter rail with category chips and live thumbnails. Only the
 * visible category's thumbnails exist in the DOM, so at most a handful render per tick.
 */
@Component({
  selector: 'app-filter-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Chip, Icon, FilterThumbnail, RouterLink],
  host: { '[class.compact]': 'compact()' },
  template: `
    <div class="chips" role="tablist" aria-label="Filter categories">
      @for (c of categories(); track c.id) {
        <button appChip role="tab" [selected]="c.id === category()" [attr.aria-selected]="c.id === category()" (click)="category.set(c.id)">
          {{ c.name }}
        </button>
      }
    </div>

    <div #rail class="rail" role="radiogroup" aria-label="Filters" (keydown)="onKeydown($event)">
      @for (f of visible(); track f.id) {
        <button
          type="button"
          role="radio"
          class="item"
          [class.active]="f.id === selectedId()"
          [attr.aria-checked]="f.id === selectedId()"
          [attr.data-id]="f.id"
          [tabindex]="f.id === selectedId() ? 0 : -1"
          (click)="filterChange.emit(f)"
        >
          <span class="thumb"><app-filter-thumbnail [source]="source()" [filter]="f" [size]="thumbSize()" /></span>
          <span class="name">{{ f.name }}</span>
        </button>
      }
      @if (showCreate()) {
        <a class="item create" routerLink="/filters/new" aria-label="Create your own filter">
          <span class="thumb plus"><app-icon name="plus" /></span>
          <span class="name">Create</span>
        </a>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
      --thumb: 4rem;
    }
    :host(.compact) {
      --thumb: 3.25rem;
    }
    .chips,
    .rail {
      display: flex;
      gap: var(--space-2);
      overflow-x: auto;
      scrollbar-width: none;
      padding-inline: var(--gutter);
      -webkit-overflow-scrolling: touch;
    }
    .chips::-webkit-scrollbar,
    .rail::-webkit-scrollbar {
      display: none;
    }
    .rail {
      gap: var(--space-3);
      scroll-snap-type: x proximity;
      padding-block: var(--space-1);
      scroll-padding-inline: var(--gutter);
    }
    .item {
      flex: none;
      display: grid;
      justify-items: center;
      gap: 6px;
      width: calc(var(--thumb) + 0.5rem);
      scroll-snap-align: center;
      color: var(--text-muted);
      border-radius: var(--radius-md);
      padding: 2px;
    }
    .item.active {
      color: var(--text);
    }
    .thumb {
      display: block;
      width: var(--thumb);
      height: var(--thumb);
      border-radius: var(--radius-md);
      overflow: hidden;
      outline: 2px solid transparent;
      outline-offset: 2px;
      transition: outline-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
    }
    .item.active .thumb {
      outline-color: var(--accent);
      transform: scale(1.04);
    }
    .plus {
      display: grid;
      place-items: center;
      border: 2px dashed var(--border);
      color: var(--text-muted);
    }
    .name {
      font-size: var(--text-xs);
      font-weight: 600;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (min-width: 900px) {
      .chips,
      .rail {
        justify-content: center;
      }
    }
  `,
})
export class FilterSelector {
  readonly filters = input.required<readonly FilterDefinition[]>();
  readonly selectedId = input.required<string>();
  readonly source = input<ImageBitmap | null>(null);
  readonly compact = input(false);
  /** Appends a "Create" tile linking to the filter editor. */
  readonly showCreate = input(false);
  readonly filterChange = output<FilterDefinition>();

  protected readonly category = signal<FilterCategory>('natural');
  protected readonly thumbSize = computed(() => (this.compact() ? 52 : 64));
  private readonly rail = viewChild.required<ElementRef<HTMLElement>>('rail');

  protected readonly categories = computed(() => {
    const present = new Set(this.filters().map((f) => f.category));
    return FILTER_CATEGORIES.filter((c) => present.has(c.id));
  });

  protected readonly visible = computed(() => this.filters().filter((f) => f.category === this.category()));

  constructor() {
    // Follow the selection into its category (e.g. restored from a previous visit).
    effect(() => {
      const selected = this.filters().find((f) => f.id === this.selectedId());
      if (selected) this.category.set(selected.category);
    });
    effect(() => {
      const id = this.selectedId();
      this.visible();
      const el = this.rail().nativeElement.querySelector<HTMLElement>(`[data-id="${id}"]`);
      el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const list = this.visible();
    const idx = list.findIndex((f) => f.id === this.selectedId());
    const next = list[(idx + dir + list.length) % list.length];
    if (next) {
      this.filterChange.emit(next);
      this.rail().nativeElement.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus();
    }
  }
}
