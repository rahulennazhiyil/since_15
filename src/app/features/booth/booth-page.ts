import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BoothSession } from '../../core/booth/booth-session';
import { SoundService } from '../../core/booth/sound.service';
import { CameraService } from '../../core/camera/camera.service';
import { FilterCatalog } from '../../core/filters/filter-catalog.service';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { THUMBNAIL_EDGE, ThumbnailSource } from '../../core/filters/thumbnail-source';
import { ProfileService } from '../../core/profile/profile.service';
import { IconButton } from '../../shared/ui/icon-button';
import { Spinner } from '../../shared/ui/spinner';
import { ToastService } from '../../shared/ui/toast.service';
import { CustomFilterStore } from '../../core/storage/custom-filter-store';
import { uid } from '../../shared/utils/id';
import type { PhotoMeta } from '../../core/storage/photo-store';
import { setUpAutoSave } from '../memories/auto-save';
import { MemoryWall } from '../memories/memory-wall';
import { PhotoViewer } from '../memories/photo-viewer';
import { FilterSelector } from '../filters/filter-selector';
import { CameraControls } from './camera-controls';
import { CameraPermissionIntro } from './camera-permission-intro';
import { CameraView } from './camera-view';
import { CountdownOverlay } from './countdown-overlay';
import { FlashOverlay } from './flash-overlay';
import { ModeSelector } from './mode-selector';
import { PhotoReveal } from './photo-reveal';

const THUMBNAIL_REFRESH_MS = 3000;

/**
 * The solo booth at /booth. Owns the page-level wiring only; the camera lives in
 * CameraService and the capture sequence in BoothSession.
 */
@Component({
  selector: 'app-booth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BoothSession],
  imports: [
    CameraView,
    CameraControls,
    CameraPermissionIntro,
    CountdownOverlay,
    FlashOverlay,
    ModeSelector,
    PhotoReveal,
    FilterSelector,
    MemoryWall,
    PhotoViewer,
    IconButton,
    Spinner,
  ],
  host: { '(document:keydown)': 'onKeydown($event)' },
  templateUrl: './booth-page.html',
  styleUrl: './booth-page.scss',
})
export class BoothPage {
  protected readonly camera = inject(CameraService);
  protected readonly session = inject(BoothSession);
  protected readonly profile = inject(ProfileService);
  protected readonly catalog = inject(FilterCatalog);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly cameraView = viewChild(CameraView);
  protected readonly starting = signal(false);
  protected readonly thumbs = new ThumbnailSource();
  /** Groups this visit's photos on the memory wall. */
  protected readonly sessionId = uid('s');
  protected readonly viewing = signal<PhotoMeta | null>(null);

  constructor() {
    // Custom filters join the rail once loaded; kept out of the initial bundle on purpose.
    void inject(CustomFilterStore).load();
    this.session.onTick = () => this.sound.tick();
    this.session.onShutter = () => this.sound.shutter();
    this.session.filter.set(this.catalog.find(this.profile.profile().lastFilterId));

    effect(() => {
      const error = this.session.error();
      if (error) this.toast.error(error);
    });

    setUpAutoSave(this.session.photo, () => ({
      sessionId: this.sessionId,
      roomCode: null,
      filterId: this.session.filter().id,
      participants: [this.profile.profile().name],
      quality: 'full',
    }));

    // Thumbnails follow the live camera while shooting and pause on the reveal screen.
    effect(() => {
      const view = this.cameraView();
      const live = this.camera.isLive();
      const reviewing = this.session.phase() === 'review';
      if (view && live && !reviewing) {
        this.thumbs.start(() => view.grabFrame(THUMBNAIL_EDGE), THUMBNAIL_REFRESH_MS);
      } else {
        this.thumbs.stop();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.thumbs.dispose();
      this.camera.stop();
    });
  }

  protected async start(): Promise<void> {
    this.starting.set(true);
    await this.camera.start({ audio: false });
    this.starting.set(false);
  }

  protected async shutter(): Promise<void> {
    const view = this.cameraView();
    if (!view || !this.camera.isLive() || this.session.busy()) return;
    await this.session.capture(() => view.grabFrame(environment.photo.maxLongEdge));
  }

  protected onFilter(filter: FilterDefinition): void {
    this.session.setFilter(filter);
    this.profile.update({ lastFilterId: filter.id });
  }

  protected exit(): void {
    void this.router.navigateByUrl('/');
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.repeat) return;

    switch (event.key) {
      case ' ':
        if (this.session.phase() === 'idle') {
          event.preventDefault();
          void this.shutter();
        }
        break;
      case 'f':
      case 'F':
        if (!this.session.busy()) void this.camera.flip();
        break;
      case 'Escape':
        this.session.cancel();
        break;
    }
  }
}
