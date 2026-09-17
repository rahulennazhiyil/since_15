import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { BoothPhoto } from '../../core/booth/booth-session';
import { toAppError } from '../../core/errors/app-error';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { photoFileName } from '../../core/photo/image-encode';
import type { LayoutId } from '../../core/photo/layouts';
import { FocusTrap } from '../../shared/a11y/focus-trap';
import { Button } from '../../shared/ui/button';
import { Chip } from '../../shared/ui/chip';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Spinner } from '../../shared/ui/spinner';
import { ToastService } from '../../shared/ui/toast.service';
import { canShareFiles, downloadBlob, shareBlob } from '../../shared/utils/download';
import { FilterSelector } from '../filters/filter-selector';

/**
 * The moment after capture: darken, reveal the photo, offer Save / Share / Retake and,
 * when a filter list is supplied, a compact rail to change the look without retaking.
 */
@Component({
  selector: 'app-photo-reveal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Chip, Icon, IconButton, Spinner, FocusTrap, FilterSelector],
  host: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'reveal-title', '[class.has-rail]': 'hasRail()' },
  template: `
    <div class="panel" appFocusTrap>
      <button appIconButton icon="close" label="Back to camera" variant="glass" class="close" (click)="dismiss.emit()"></button>
      <p id="reveal-title" class="title">{{ title() }} <span aria-hidden="true">❤️</span></p>

      <div class="frame">
        <img
          [src]="photo().url"
          [width]="photo().width"
          [height]="photo().height"
          [class.tall]="photo().height > photo().width"
          [class.dim]="busy()"
          alt="Your photo"
        />
        @if (busy()) {
          <div class="busy"><app-spinner label="Applying filter" /></div>
        }
      </div>

      @if (layouts().length > 0) {
        <div class="layouts" role="radiogroup" aria-label="Frame">
          @for (l of layouts(); track l.id) {
            <button appChip role="radio" [selected]="l.id === layoutId()" [attr.aria-checked]="l.id === layoutId()" [disabled]="busy()" (click)="layoutChange.emit(l.id)">
              {{ l.name }}
            </button>
          }
        </div>
      }
      @if (note(); as n) {
        <p class="note">{{ n }}</p>
      }

      @if (hasRail()) {
        <app-filter-selector
          class="rail"
          [compact]="true"
          [filters]="filters()"
          [selectedId]="filter()!.id"
          [source]="thumbSource()"
          (filterChange)="filterChange.emit($event)"
        />
      }

      <div class="actions">
        <button appButton variant="secondary" [disabled]="busy()" (click)="retake.emit()">
          <app-icon name="retry" [size]="18" /> Retake
        </button>
        <button appButton [disabled]="busy()" (click)="save()">
          <app-icon name="download" [size]="18" /> Save
        </button>
        @if (shareable) {
          <button appButton variant="secondary" [loading]="sharing()" [disabled]="busy()" (click)="share()">
            <app-icon name="share" [size]="18" /> Share
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: grid;
      place-items: center;
      padding: calc(var(--space-4) + var(--safe-top)) 0 calc(var(--space-6) + var(--safe-bottom));
      background: rgb(0 0 0 / 0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      animation: fade-in var(--dur-base) var(--ease-out) both;
    }
    .panel {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      width: 100%;
      max-width: 44rem;
    }
    .close {
      position: fixed;
      top: calc(var(--space-3) + var(--safe-top));
      right: var(--gutter);
    }
    .title {
      color: #fff;
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-2xl);
    }
    .frame {
      position: relative;
      display: grid;
      place-items: center;
      padding-inline: var(--space-4);
    }
    img {
      max-width: 100%;
      /* Leave room for the title, the rail and the action row on small phones. */
      max-height: min(calc(100dvh - 11rem), 720px);
      width: auto;
      height: auto;
      border-radius: var(--radius-lg);
      box-shadow: 0 30px 80px rgb(0 0 0 / 0.5);
      animation: reveal 520ms var(--ease-out) both;
      transition: opacity var(--dur-base) var(--ease-out);
    }
    :host(.has-rail) img {
      max-height: min(calc(100dvh - 18rem), 640px);
    }
    img.tall {
      border-radius: var(--radius-md);
    }
    img.dim {
      opacity: 0.6;
    }
    .busy {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #fff;
    }
    .rail {
      width: 100%;
    }
    .layouts {
      display: flex;
      gap: var(--space-2);
      max-width: 100%;
      overflow-x: auto;
      padding-inline: var(--space-4);
      scrollbar-width: none;
    }
    .layouts::-webkit-scrollbar {
      display: none;
    }
    .note {
      color: rgb(255 255 255 / 0.7);
      font-size: var(--text-sm);
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: var(--space-2);
      max-width: 100%;
      padding-inline: var(--space-4);
    }
    .actions > [appButton] {
      padding-inline: var(--space-4);
    }
    @media (min-width: 480px) {
      .actions {
        gap: var(--space-3);
      }
      .actions > [appButton] {
        padding-inline: var(--space-5);
      }
    }
    @keyframes reveal {
      from {
        opacity: 0;
        transform: translateY(24px) scale(0.92);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class PhotoReveal {
  readonly photo = input.required<BoothPhoto>();
  readonly title = input('Your photo is ready');
  /** Supply all three to show the filter rail. */
  readonly filters = input<readonly FilterDefinition[]>([]);
  readonly filter = input<FilterDefinition | null>(null);
  readonly thumbSource = input<ImageBitmap | null>(null);
  /** True while the photo is being re-rendered. */
  readonly busy = input(false);
  /** Optional frame choices (couple booth). */
  readonly layouts = input<readonly { id: LayoutId; name: string }[]>([]);
  readonly layoutId = input<LayoutId | null>(null);
  /** Small line under the photo, e.g. while a sharper copy is on its way. */
  readonly note = input<string | null>(null);

  readonly retake = output<void>();
  /** Close without an explicit retake; the page decides what that means. */
  readonly dismiss = output<void>();
  readonly filterChange = output<FilterDefinition>();
  readonly layoutChange = output<LayoutId>();

  protected readonly shareable = canShareFiles();
  protected readonly sharing = signal(false);
  private readonly toast = inject(ToastService);

  protected hasRail(): boolean {
    return this.filters().length > 0 && this.filter() !== null;
  }

  protected save(): void {
    const p = this.photo();
    downloadBlob(p.blob, photoFileName(new Date(p.createdAt)));
    this.toast.success('Saved to your downloads');
  }

  protected async share(): Promise<void> {
    const p = this.photo();
    this.sharing.set(true);
    try {
      const outcome = await shareBlob(p.blob, photoFileName(new Date(p.createdAt)), 'Made with since060815');
      if (outcome === 'unsupported') this.save();
    } catch (error) {
      this.toast.error(toAppError(error));
    } finally {
      this.sharing.set(false);
    }
  }
}
