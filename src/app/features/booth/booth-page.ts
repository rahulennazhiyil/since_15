import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BoothSession } from '../../core/booth/booth-session';
import { SoundService } from '../../core/booth/sound.service';
import { CameraService } from '../../core/camera/camera.service';
import { AppError, toAppError } from '../../core/errors/app-error';
import { FilterCatalog } from '../../core/filters/filter-catalog.service';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { sampleFrame } from '../../core/filters/sample-frame';
import { ProfileService } from '../../core/profile/profile.service';
import { NO_BACKGROUND_ID } from '../../core/scene/background-catalog';
import type { BackgroundFx } from '../../core/scene/scene.model';
import { SegmentationService } from '../../core/segmentation/segmentation.service';
import { BackgroundStore } from '../../core/storage/background-store';
import { CustomFilterStore } from '../../core/storage/custom-filter-store';
import { PhotoStore, type PhotoMeta } from '../../core/storage/photo-store';
import { IconButton } from '../../shared/ui/icon-button';
import { Spinner } from '../../shared/ui/spinner';
import { ToastService } from '../../shared/ui/toast.service';
import { uid } from '../../shared/utils/id';
import { FilterSelector } from '../filters/filter-selector';
import { setUpAutoSave } from '../memories/auto-save';
import { MemoryWall } from '../memories/memory-wall';
import { PhotoViewer } from '../memories/photo-viewer';
import { BackgroundSheet } from '../scene/background-sheet';
import { SceneStage, type PlacementEvent } from '../scene/scene-stage';
import { CameraControls } from './camera-controls';
import { CameraPermissionIntro } from './camera-permission-intro';
import { CameraView } from './camera-view';
import { CountdownOverlay } from './countdown-overlay';
import { FlashOverlay } from './flash-overlay';
import { ModeSelector } from './mode-selector';
import { PhotoReveal } from './photo-reveal';

/**
 * The solo booth at /booth. Owns the page-level wiring only; the camera lives in
 * CameraService and the capture sequence in BoothSession. With a background chosen the
 * plain camera view gives way to the scene stage, which cuts the person out live.
 */
@Component({
  selector: 'app-booth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BoothSession],
  imports: [
    CameraView,
    SceneStage,
    BackgroundSheet,
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
  protected readonly segmentation = inject(SegmentationService);
  protected readonly backgrounds = inject(BackgroundStore);
  private readonly photos = inject(PhotoStore);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private readonly cameraView = viewChild(CameraView);
  private readonly stage = viewChild(SceneStage);
  protected readonly starting = signal(false);
  /** Filter thumbnails render from a fixed sample scene, never from the live camera. */
  protected readonly thumbSource = signal<ImageBitmap | null>(null);
  /** Groups this visit's photos on the memory wall. */
  protected readonly sessionId = uid('s');
  protected readonly viewing = signal<PhotoMeta | null>(null);
  protected readonly backgroundOpen = signal(false);
  /** Object URLs for the user's own background photos, for the picker tiles. */
  protected readonly customTiles = signal<{ id: string; url: string }[]>([]);
  protected readonly importing = signal(false);

  /** Newest photo of this visit, for the small gallery button next to the shutter. */
  protected readonly lastPhoto = computed(() => this.photos.bySession(this.sessionId)[0] ?? null);
  /** Backgrounds are offered only where the on-device model can run. */
  protected readonly backgroundsAvailable = computed(() => this.segmentation.supported && this.segmentation.status() !== 'unsupported');
  protected readonly useStage = computed(() => this.session.sceneEnabled() && this.backgroundsAvailable());

  constructor() {
    // Custom filters join the rail once loaded; kept out of the initial bundle on purpose.
    void inject(CustomFilterStore).load();
    void this.photos.load();
    void sampleFrame().then((bitmap) => this.thumbSource.set(bitmap));
    this.session.onTick = () => this.sound.tick();
    this.session.onShutter = () => this.sound.shutter();
    this.session.filter.set(this.catalog.find(this.profile.profile().lastFilterId));

    effect(() => {
      const error = this.session.error();
      if (error) this.toast.error(error);
    });

    // The user's own background photos, as picker tiles.
    void this.backgrounds.load();
    effect(() => {
      const mine = this.backgrounds.mine();
      void Promise.all(mine.map(async (b) => ({ id: b.id, url: (await this.backgrounds.urlFor(b.id)) ?? '' }))).then((tiles) =>
        this.customTiles.set(tiles.filter((t) => t.url)),
      );
    });

    // If the model turns out not to run here, fall back to the plain camera and say so once.
    effect(() => {
      if (this.segmentation.status() === 'unsupported' && this.session.sceneEnabled()) {
        this.session.setScene({ backgroundId: NO_BACKGROUND_ID });
        this.toast.error(new AppError('scene-unsupported'));
      }
    });

    setUpAutoSave(this.session.photo, () => ({
      sessionId: this.sessionId,
      roomCode: null,
      filterId: this.session.filter().id,
      participants: [this.profile.profile().name],
      quality: 'full',
    }));

    inject(DestroyRef).onDestroy(() => {
      this.camera.stop();
    });
  }

  /** Whichever view is showing the camera right now. */
  private frameGrabber(): ((maxLongEdge?: number) => Promise<ImageBitmap>) | null {
    const stage = this.stage();
    if (stage) return (edge) => stage.grabFrame(edge);
    const view = this.cameraView();
    if (view) return (edge) => view.grabFrame(edge);
    return null;
  }

  protected async start(): Promise<void> {
    this.starting.set(true);
    await this.camera.start({ audio: false });
    this.starting.set(false);
    if (this.backgroundsAvailable()) this.segmentation.prewarm();
  }

  protected async shutter(): Promise<void> {
    const grab = this.frameGrabber();
    if (!grab || !this.camera.isLive() || this.session.busy()) return;
    await this.session.capture(() => grab(environment.photo.maxLongEdge));
  }

  protected onFilter(filter: FilterDefinition): void {
    this.session.setFilter(filter);
    this.profile.update({ lastFilterId: filter.id });
  }

  protected onBackground(id: string): void {
    this.session.setBackground(id);
  }

  protected onFx(fx: BackgroundFx): void {
    this.session.setScene({ fx });
  }

  protected onPlacement(event: PlacementEvent): void {
    this.session.setScene({ people: { [event.role]: event.placement } });
  }

  /** "Your photo": store it on this device and use it straight away. */
  protected async onUpload(file: File): Promise<void> {
    if (this.importing()) return;
    this.importing.set(true);
    try {
      const stored = await this.backgrounds.importFile(file);
      this.session.setBackground(stored.id);
      this.toast.success('Background added');
    } catch (error) {
      this.toast.error(toAppError(error, 'photo-failed'));
    } finally {
      this.importing.set(false);
    }
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
