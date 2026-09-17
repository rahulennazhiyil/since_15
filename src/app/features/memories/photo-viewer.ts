import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { toAppError } from '../../core/errors/app-error';
import { photoFileName } from '../../core/photo/image-encode';
import { PhotoStore, type PhotoMeta } from '../../core/storage/photo-store';
import { FocusTrap } from '../../shared/a11y/focus-trap';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Spinner } from '../../shared/ui/spinner';
import { ToastService } from '../../shared/ui/toast.service';
import { canShareFiles, downloadBlob, shareBlob } from '../../shared/utils/download';
import { ObjectUrlPool } from '../../shared/utils/object-url';

/** Full-screen view of one stored photo with save, share and delete. */
@Component({
  selector: 'app-photo-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, IconButton, Spinner, FocusTrap],
  host: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'viewer-title', '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="panel" appFocusTrap>
      <button appIconButton icon="close" label="Close" variant="glass" class="close" (click)="closed.emit()"></button>
      <p id="viewer-title" class="title">{{ title() }}</p>
      @if (subtitle(); as s) {
        <p class="subtitle">{{ s }}</p>
      }

      <div class="frame">
        @if (url(); as u) {
          <img [src]="u" [width]="photo().width" [height]="photo().height" alt="Saved photo" />
        } @else {
          <app-spinner size="lg" label="Loading photo" />
        }
      </div>

      <div class="actions">
        @if (confirming()) {
          <span class="small">Delete this photo?</span>
          <button appButton variant="ghost" size="sm" (click)="confirming.set(false)">Keep</button>
          <button appButton variant="danger" size="sm" (click)="remove()">Delete</button>
        } @else {
          <button appButton variant="secondary" [disabled]="!blob()" (click)="save()"><app-icon name="download" [size]="18" /> Save</button>
          @if (shareable) {
            <button appButton variant="secondary" [disabled]="!blob()" [loading]="sharing()" (click)="share()"><app-icon name="share" [size]="18" /> Share</button>
          }
          <button appButton variant="ghost" (click)="confirming.set(true)"><app-icon name="trash" [size]="18" /> Delete</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: grid;
      place-items: center;
      padding: calc(var(--space-4) + var(--safe-top)) var(--space-4) calc(var(--space-6) + var(--safe-bottom));
      background: rgb(0 0 0 / 0.8);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      color: #fff;
      animation: fade-in var(--dur-base) var(--ease-out) both;
    }
    .panel {
      display: grid;
      justify-items: center;
      gap: var(--space-3);
      width: 100%;
      max-width: 48rem;
    }
    .close {
      position: fixed;
      top: calc(var(--space-3) + var(--safe-top));
      right: var(--gutter);
    }
    .title {
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-xl);
    }
    .subtitle {
      color: rgb(255 255 255 / 0.7);
      font-size: var(--text-sm);
      margin-top: calc(-1 * var(--space-2));
    }
    .frame {
      display: grid;
      place-items: center;
      min-height: 12rem;
    }
    img {
      max-width: 100%;
      max-height: min(calc(100dvh - 12rem), 760px);
      width: auto;
      height: auto;
      border-radius: var(--radius-lg);
      box-shadow: 0 30px 80px rgb(0 0 0 / 0.5);
      animation: scale-in var(--dur-slow) var(--ease-out) both;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      --surface: #26232c;
      --surface-2: rgb(255 255 255 / 0.14);
      --text: #fff;
      --border: rgb(255 255 255 / 0.14);
    }
  `,
})
export class PhotoViewer {
  readonly photo = input.required<PhotoMeta>();
  readonly closed = output<void>();
  readonly deleted = output<string>();

  private readonly store = inject(PhotoStore);
  private readonly toast = inject(ToastService);
  private readonly urls = new ObjectUrlPool();
  protected readonly blob = signal<Blob | null>(null);
  protected readonly url = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly sharing = signal(false);
  protected readonly shareable = canShareFiles();

  protected readonly title = computed(() => {
    const d = new Date(this.photo().createdAt);
    return d.toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  });
  protected readonly subtitle = computed(() => {
    const people = this.photo().participants.filter(Boolean);
    return people.length > 1 ? people.join(' & ') : null;
  });

  constructor() {
    effect(() => {
      const meta = this.photo();
      this.urls.revokeAll();
      this.blob.set(null);
      this.url.set(null);
      this.confirming.set(false);
      void this.store.getBlob(meta.id).then((b) => {
        if (b && this.photo().id === meta.id) {
          this.blob.set(b);
          this.url.set(this.urls.create(b));
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.urls.revokeAll());
  }

  protected save(): void {
    const b = this.blob();
    if (!b) return;
    downloadBlob(b, photoFileName(new Date(this.photo().createdAt)));
    this.toast.success('Saved to your downloads');
  }

  protected async share(): Promise<void> {
    const b = this.blob();
    if (!b) return;
    this.sharing.set(true);
    try {
      const outcome = await shareBlob(b, photoFileName(new Date(this.photo().createdAt)), 'Made with since060815');
      if (outcome === 'unsupported') this.save();
    } catch (error) {
      this.toast.error(toAppError(error));
    } finally {
      this.sharing.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const id = this.photo().id;
    try {
      await this.store.remove(id);
      this.toast.show('Photo deleted');
      this.deleted.emit(id);
      this.closed.emit();
    } catch (error) {
      this.toast.error(toAppError(error, 'storage-failed'));
    }
  }
}
