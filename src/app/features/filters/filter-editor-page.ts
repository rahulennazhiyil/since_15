import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CameraService } from '../../core/camera/camera.service';
import { toAppError } from '../../core/errors/app-error';
import { FilterCatalog } from '../../core/filters/filter-catalog.service';
import { FilterDraft, MAX_NAME_LENGTH } from '../../core/filters/filter-draft';
import type { Adjustments } from '../../core/filters/filter.model';
import { CustomFilterStore } from '../../core/storage/custom-filter-store';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Segmented, type SegmentOption } from '../../shared/ui/segmented';
import { Sheet } from '../../shared/ui/sheet';
import { Spinner } from '../../shared/ui/spinner';
import { ToastService } from '../../shared/ui/toast.service';
import { AdjustmentPanel } from './adjustment-panel';
import { EffectsPanel } from './effects-panel';
import { FilterPreview } from './filter-preview';
import { OverlayCanvas, type OverlayMove } from './overlay-canvas';
import { OverlayPanel } from './overlay-panel';

type Tab = 'light' | 'color' | 'effects' | 'stickers';

const TABS: readonly SegmentOption<Tab>[] = [
  { value: 'light', label: 'Light' },
  { value: 'color', label: 'Color' },
  { value: 'effects', label: 'Effects' },
  { value: 'stickers', label: 'Stickers' },
];

const LIGHT_KEYS: (keyof Adjustments)[] = ['brightness', 'contrast', 'exposure', 'shadows', 'highlights', 'fade', 'blur', 'sharpen'];
const COLOR_KEYS: (keyof Adjustments)[] = ['saturation', 'temperature', 'tint', 'hue', 'sepia'];

/**
 * /filters/new and /filters/:id. Edits a FilterDraft with a live preview; the camera
 * is optional and only requested when the user asks for it.
 */
@Component({
  selector: 'app-filter-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    Icon,
    IconButton,
    Segmented,
    Sheet,
    Spinner,
    AdjustmentPanel,
    EffectsPanel,
    OverlayPanel,
    FilterPreview,
    OverlayCanvas,
  ],
  templateUrl: './filter-editor-page.html',
  styleUrl: './filter-editor-page.scss',
})
export class FilterEditorPage {
  /** Route param: an existing custom filter to edit. */
  readonly id = input<string>();
  /** Query param: a filter to start from (duplicate). */
  readonly from = input<string>();

  protected readonly camera = inject(CameraService);
  private readonly store = inject(CustomFilterStore);
  private readonly catalog = inject(FilterCatalog);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly draft = signal<FilterDraft | null>(null);
  protected readonly tab = signal<Tab>('light');
  protected readonly saving = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly tabs = TABS;
  protected readonly lightKeys = LIGHT_KEYS;
  protected readonly colorKeys = COLOR_KEYS;
  protected readonly maxName = MAX_NAME_LENGTH;
  protected readonly isEdit = computed(() => !!this.id());

  constructor() {
    effect(() => {
      const id = this.id();
      const from = this.from();
      void this.initDraft(id, from);
    });
    inject(DestroyRef).onDestroy(() => this.camera.stop());
  }

  private async initDraft(id: string | undefined, from: string | undefined): Promise<void> {
    await this.store.load();
    if (id) {
      const existing = this.store.find(id);
      if (!existing) {
        this.toast.show('That filter no longer exists.');
        void this.router.navigateByUrl('/filters');
        return;
      }
      this.draft.set(new FilterDraft(existing));
      return;
    }
    const draft = new FilterDraft();
    if (from) {
      const base = this.catalog.find(from);
      const copy = new FilterDraft({ ...base, id: draft.id, createdAt: undefined });
      copy.setName(`${base.name} copy`);
      this.draft.set(copy);
      return;
    }
    this.draft.set(draft);
  }

  protected useCamera(): void {
    void this.camera.start({ audio: false }).then((ok) => {
      const error = this.camera.error();
      if (!ok && error) this.toast.error(error);
    });
  }

  protected onMove(move: OverlayMove): void {
    this.draft()?.nudgeOverlay(move.id, move.dx, move.dy);
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || !draft.isValid() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.save(draft.definition());
      this.toast.success(`“${draft.name().trim()}” saved to your filters`);
      void this.router.navigateByUrl('/filters');
    } catch (error) {
      this.toast.error(toAppError(error, 'storage-failed'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;
    try {
      await this.store.remove(draft.id);
      this.confirmDelete.set(false);
      this.toast.show('Filter deleted');
      void this.router.navigateByUrl('/filters');
    } catch (error) {
      this.toast.error(toAppError(error, 'storage-failed'));
    }
  }

  protected back(): void {
    void this.router.navigateByUrl('/filters');
  }
}
