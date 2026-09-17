import { Injectable, computed, signal } from '@angular/core';
import { FILTER_CATEGORIES, type FilterCategory, type FilterDefinition } from './filter.model';
import { ORIGINAL_FILTER, PRESET_FILTERS } from './presets';

/**
 * Every filter the app knows about: presets plus (from Phase 4) the user's own.
 * Components read from here; nothing else imports the preset list directly.
 */
@Injectable({ providedIn: 'root' })
export class FilterCatalog {
  private readonly custom = signal<FilterDefinition[]>([]);

  readonly presets: readonly FilterDefinition[] = PRESET_FILTERS;
  readonly all = computed<readonly FilterDefinition[]>(() => [...this.presets, ...this.custom()]);

  /** Categories that currently contain at least one filter, in display order. */
  readonly categories = computed(() => {
    const present = new Set(this.all().map((f) => f.category));
    return FILTER_CATEGORIES.filter((c) => present.has(c.id));
  });

  find(id: string | null | undefined): FilterDefinition {
    return this.all().find((f) => f.id === id) ?? ORIGINAL_FILTER;
  }

  byCategory(category: FilterCategory): FilterDefinition[] {
    return this.all().filter((f) => f.category === category);
  }

  /** Replaces the custom set; the custom filter store calls this when it loads or changes. */
  setCustom(filters: FilterDefinition[]): void {
    this.custom.set(filters);
  }
}
