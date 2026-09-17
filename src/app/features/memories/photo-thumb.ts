import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import type { PhotoMeta } from '../../core/storage/photo-store';
import { PhotoStore } from '../../core/storage/photo-store';
import { ObjectUrlPool } from '../../shared/utils/object-url';

/** Lazy thumbnail for a stored photo; loads the small cached copy, never the full image. */
@Component({
  selector: 'app-photo-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url(); as u) {
      <img [src]="u" [alt]="alt()" decoding="async" />
    }
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface-2);
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      animation: fade-in var(--dur-base) var(--ease-out) both;
    }
  `,
})
export class PhotoThumb {
  readonly photo = input.required<PhotoMeta>();
  readonly alt = input('Photo');

  private readonly store = inject(PhotoStore);
  private readonly urls = new ObjectUrlPool();
  protected readonly url = signal<string | null>(null);

  constructor() {
    effect(() => {
      const meta = this.photo();
      this.urls.revokeAll();
      this.url.set(null);
      void this.store.getThumbnail(meta.id).then((blob) => {
        if (blob && this.photo().id === meta.id) this.url.set(this.urls.create(blob));
      });
    });
    inject(DestroyRef).onDestroy(() => this.urls.revokeAll());
  }
}
