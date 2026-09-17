import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BOOTH_MODES, type BoothMode, type CountdownSeconds } from '../../core/booth/booth-session';
import { CaptureCoordinator } from '../../core/booth/capture-coordinator';
import { CoupleSession } from '../../core/booth/couple-session';
import { SoundService } from '../../core/booth/sound.service';
import { CameraService } from '../../core/camera/camera.service';
import { AppError, toAppError } from '../../core/errors/app-error';
import { ERROR_COPY } from '../../core/errors/error-copy';
import { FilterCatalog } from '../../core/filters/filter-catalog.service';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { sampleFrame } from '../../core/filters/sample-frame';
import { LAYOUTS, PAIR_LAYOUT_CHOICES, TOGETHER_LAYOUT_CHOICES, type LayoutId } from '../../core/photo/layouts';
import { ProfileService } from '../../core/profile/profile.service';
import { RoomService } from '../../core/room/room.service';
import { NO_BACKGROUND_ID } from '../../core/scene/background-catalog';
import type { BackgroundFx, PersonRole } from '../../core/scene/scene.model';
import { BackgroundStore } from '../../core/storage/background-store';
import { Announcer } from '../../shared/a11y/announcer.service';
import { Button } from '../../shared/ui/button';
import { Chip } from '../../shared/ui/chip';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Sheet } from '../../shared/ui/sheet';
import { Spinner } from '../../shared/ui/spinner';
import { ActivityHost } from '../activities/activity-host';
import { ToastService } from '../../shared/ui/toast.service';
import { CustomFilterStore } from '../../core/storage/custom-filter-store';
import { uid } from '../../shared/utils/id';
import { PhotoStore, type PhotoMeta } from '../../core/storage/photo-store';
import { setUpAutoSave } from '../memories/auto-save';
import { MemoryWall } from '../memories/memory-wall';
import { PhotoViewer } from '../memories/photo-viewer';
import { CameraControls } from '../booth/camera-controls';
import { CameraPermissionIntro } from '../booth/camera-permission-intro';
import { CameraView } from '../booth/camera-view';
import { CountdownOverlay } from '../booth/countdown-overlay';
import { FlashOverlay } from '../booth/flash-overlay';
import { ModeSelector } from '../booth/mode-selector';
import { PhotoReveal } from '../booth/photo-reveal';
import { FilterSelector } from '../filters/filter-selector';
import { ArrangeSheet } from '../scene/arrange-sheet';
import { BackgroundSheet } from '../scene/background-sheet';
import { ParticipantBadge } from '../scene/participant-badge';
import { SceneStage, type PlacementEvent } from '../scene/scene-stage';
import { IdentityForm } from '../profile/identity-form';
import { ParticipantView } from './participant-view';
import { RoomHeader } from './room-header';
import { RoomMediaService } from './room-media.service';
import { RoomWaiting } from './room-waiting';
import { SceneSync } from './scene-sync.service';

/** Gap between strip shots in a room; long enough for a visible countdown. */
const STRIP_INTERVAL_MS = 3000;
const BURST_INTERVAL_MS = 650;

/**
 * /room/:code. Enters the room (as host if this client created it, otherwise as guest),
 * asks for the camera, shows the right screen for the room's state and runs the
 * synchronized couple booth once both are connected.
 */
@Component({
  selector: 'app-room-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RoomMediaService, CoupleSession, SceneSync],
  imports: [
    RouterLink,
    Button,
    Chip,
    Icon,
    IconButton,
    Sheet,
    Spinner,
    ActivityHost,
    CameraPermissionIntro,
    CameraView,
    CameraControls,
    CountdownOverlay,
    FlashOverlay,
    ModeSelector,
    PhotoReveal,
    FilterSelector,
    MemoryWall,
    PhotoViewer,
    IdentityForm,
    ParticipantView,
    ParticipantBadge,
    SceneStage,
    BackgroundSheet,
    ArrangeSheet,
    RoomHeader,
    RoomWaiting,
  ],
  host: { '(document:keydown)': 'onKeydown($event)' },
  templateUrl: './room-page.html',
  styleUrl: './room-page.scss',
})
export class RoomPage {
  readonly code = input.required<string>();

  protected readonly room = inject(RoomService);
  protected readonly camera = inject(CameraService);
  protected readonly profile = inject(ProfileService);
  protected readonly media = inject(RoomMediaService);
  protected readonly couple = inject(CoupleSession);
  protected readonly sceneSync = inject(SceneSync);
  protected readonly catalog = inject(FilterCatalog);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly announcer = inject(Announcer);
  private readonly router = inject(Router);

  private readonly localView = viewChild(CameraView);
  private readonly partnerView = viewChild(ParticipantView);
  private readonly stage = viewChild(SceneStage);
  protected readonly backgrounds = inject(BackgroundStore);

  /** True once the user has passed the identity gate (or already had one). */
  protected readonly identified = signal(false);
  protected readonly starting = signal(false);
  protected readonly countdown = signal<CountdownSeconds>(3);
  /** Filter thumbnails render from a fixed sample scene, never from the live camera. */
  protected readonly thumbSource = signal<ImageBitmap | null>(null);
  private readonly photos = inject(PhotoStore);
  /** Newest photo of this visit, for the gallery button next to the shutter. */
  protected readonly lastPhoto = computed(() => this.photos.bySession(this.sessionId)[0] ?? null);
  /** Groups this visit's photos on the memory wall. */
  protected readonly sessionId = uid('s');
  protected readonly viewing = signal<PhotoMeta | null>(null);
  protected readonly activitiesOpen = signal(false);
  protected readonly backgroundOpen = signal(false);
  protected readonly arrangeOpen = signal(false);
  protected readonly customTiles = signal<{ id: string; url: string }[]>([]);
  protected readonly importing = signal(false);
  protected readonly selfRole = computed<PersonRole>(() => (this.room.isHost() ? 'host' : 'guest'));
  protected readonly partnerName = computed(() => this.room.partner()?.name ?? 'Your person');
  protected readonly sceneActive = computed(() => this.sceneSync.scene().backgroundId !== NO_BACKGROUND_ID);
  private lastPlacementSentAt = 0;

  protected readonly normalizedCode = computed(() => this.code().toUpperCase());
  protected readonly terminal = computed(() => ['ended', 'not-found', 'full'].includes(this.room.status()));
  protected readonly terminalCopy = computed(() => {
    const err = this.room.error();
    return err ? err.userMessage : ERROR_COPY['room-ended'];
  });
  protected readonly canShoot = computed(() => this.room.status() === 'connected' && this.media.peer.isConnected() && !this.couple.busy());
  /** Frames: one merged picture in the shared scene, two tiles in the classic view. */
  protected readonly layoutChoices = computed(() => (this.media.together() ? TOGETHER_LAYOUT_CHOICES : PAIR_LAYOUT_CHOICES).map((id) => ({ id, name: LAYOUTS[id].name })));
  protected readonly currentLayoutId = computed(() => (this.media.together() ? this.sceneSync.scene().layoutId : this.couple.layout()));
  protected readonly showLayouts = computed(() => this.couple.mode() === 'single');
  protected readonly revealNote = computed(() =>
    this.couple.photoQuality() === 'preview' ? 'A sharper copy of your person’s side is still on its way.' : null,
  );

  private readonly coordinator = new CaptureCoordinator({
    bus: () => this.media.peer.bus(),
    isHost: () => this.room.isHost(),
    now: () => performance.timeOrigin + performance.now(),
    toHostTime: (t) => this.media.toHostTime(t),
    currentFilterId: () => this.couple.filter().id,
    currentLayoutId: () => this.couple.layout(),
    together: () => this.media.together(),
    currentScene: () => this.sceneSync.scene(),
  });
  private busSubscription: Subscription | null = null;

  constructor() {
    // Custom filters join the rail once loaded; kept out of the initial bundle on purpose.
    void inject(CustomFilterStore).load();
    // Enter the room once we know who we are. Room state is read untracked on purpose:
    // a terminal state (full, ended) clears the room and must not trigger a rejoin.
    effect(() => {
      const code = this.normalizedCode();
      if (!this.identified()) return;
      untracked(() => {
        if (this.room.room()?.code === code) return; // created here as host
        void this.room.join(code);
      });
    });

    if (this.profile.hasIdentity()) this.identified.set(true);
    this.couple.filter.set(this.catalog.find(this.profile.profile().lastFilterId));
    this.couple.onTick = () => this.sound.tick();
    this.couple.onShutter = () => this.sound.shutter();

    effect(() => {
      const event = this.room.lastEvent();
      if (event === 'partner-joined') this.announcer.announce(`${this.room.partner()?.name ?? 'Your person'} is here`);
      if (event === 'partner-left') this.announcer.announce('Your person left the room');
    });

    // Bind the couple session to whatever views and channels exist right now.
    effect(() => {
      const local = this.localView();
      const partner = this.partnerView();
      const stage = this.stage();
      const blobs = this.media.peer.blobs();
      untracked(() => {
        if (!local && !stage) return;
        this.couple.bind({
          grabLocal: () => (stage ? stage.grabFrame(environment.photo.maxLongEdge) : local!.grabFrame(environment.photo.maxLongEdge)),
          grabRemote: () =>
            stage
              ? stage.grabRemoteFrame(environment.photo.maxLongEdge)
              : partner
                ? partner.grabFrame(environment.photo.maxLongEdge)
                : Promise.reject(new Error('no partner view')),
          blobs: () => blobs,
          isHost: () => this.room.isHost(),
          toLocalTime: (t) => this.media.toLocalTime(t),
          now: () => performance.timeOrigin + performance.now(),
        });
      });
    });

    // Re-attach the protocol whenever the data channel changes.
    effect(() => {
      const bus = this.media.peer.bus();
      const open = this.media.peer.channelOpen();
      untracked(() => {
        this.coordinator.attach();
        this.busSubscription?.unsubscribe();
        this.busSubscription = null;
        if (!bus || !open) return;
        this.busSubscription = bus.messages$.subscribe((m) => {
          if (m.type === 'filter') this.couple.setFilter(this.catalog.find(m.filterId));
          if (m.type === 'layout' && m.layoutId in LAYOUTS) this.couple.setLayout(m.layoutId as LayoutId);
        });
        // Share our current look with a partner who just connected.
        bus.send({ type: 'filter', filterId: this.couple.filter().id });
        bus.send({ type: 'layout', layoutId: this.couple.layout() });
      });
    });

    this.coordinator.scheduled$.subscribe((schedule) => {
      this.couple.setMode(schedule.mode);
      this.couple.filter.set(this.catalog.find(schedule.filterId));
      if (schedule.layoutId in LAYOUTS) this.couple.layout.set(schedule.layoutId as LayoutId);
      // Both devices compose from the host's snapshot of the scene.
      if (schedule.together && schedule.scene) this.sceneSync.applyFull(schedule.scene);
      void this.couple.run(schedule);
    });

    // Incoming scene edits wait while a photo is being taken; afterwards they re-render the reveal.
    effect(() => this.sceneSync.locked.set(this.couple.busy()));
    effect(() => {
      const scene = this.sceneSync.scene();
      untracked(() => {
        if (this.couple.reviewingScene()) this.couple.setScene(scene);
      });
    });
    this.coordinator.cancelled$.subscribe((id) => {
      if (this.couple.activeCaptureId() === id) this.couple.cancel();
    });

    effect(() => {
      const error = this.couple.error();
      if (error) this.toast.error(error);
    });

    setUpAutoSave(this.couple.photo, () => ({
      sessionId: this.sessionId,
      roomCode: this.normalizedCode(),
      filterId: this.couple.filter().id,
      participants: this.room.participants().map((p) => p.name),
      quality: this.couple.photoQuality(),
    }));

    void this.photos.load();
    void sampleFrame().then((bitmap) => this.thumbSource.set(bitmap));

    // The user's own background photos, as picker tiles.
    void this.backgrounds.load();
    effect(() => {
      const mine = this.backgrounds.mine();
      void Promise.all(mine.map(async (b) => ({ id: b.id, url: (await this.backgrounds.urlFor(b.id)) ?? '' }))).then((tiles) =>
        this.customTiles.set(tiles.filter((t) => t.url)),
      );
    });

    // Say once why the scene is not available when a device cannot join it.
    effect(() => {
      const caps = this.media.peerCaps();
      const mine = this.media.localSegmentation();
      untracked(() => {
        if (caps && !caps.segmentation && mine) this.toast.show(ERROR_COPY['scene-unsupported'].message.replace('This device', 'Your person\u2019s device'), { kind: 'info' });
        if (caps && !mine) this.toast.error(new AppError('scene-unsupported'));
      });
    });
    effect(() => {
      const id = [...this.sceneSync.partnerHas()].pop();
      untracked(() => {
        if (id && this.sceneSync.scene().backgroundId === id) this.toast.success(`${this.partnerName()} has your background`);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.coordinator.detach();
      this.busSubscription?.unsubscribe();
      this.camera.stop();
      void this.room.leave();
    });
  }

  protected async startCamera(): Promise<void> {
    this.starting.set(true);
    await this.camera.start({ audio: true });
    this.starting.set(false);
  }

  protected shutter(): void {
    if (!this.canShoot()) return;
    const mode = this.couple.mode();
    const info = BOOTH_MODES.find((m) => m.value === mode) ?? BOOTH_MODES[0];
    const intervalMs = mode === 'burst' ? BURST_INTERVAL_MS : info.shots > 1 ? STRIP_INTERVAL_MS : 0;
    this.coordinator.request({ mode, shots: info.shots, intervalMs, countdownMs: this.countdown() * 1000 });
  }

  protected cancelCountdown(): void {
    const id = this.couple.activeCaptureId();
    if (id && this.couple.canCancel()) this.coordinator.cancel(id);
  }

  protected setMode(mode: BoothMode): void {
    this.couple.setMode(mode);
  }

  protected onFilter(filter: FilterDefinition): void {
    this.couple.setFilter(filter);
    this.profile.update({ lastFilterId: filter.id });
    this.media.peer.bus()?.send({ type: 'filter', filterId: filter.id });
  }

  protected onLayout(layout: LayoutId): void {
    if (this.media.together()) {
      this.sceneSync.setFrame(layout);
      return;
    }
    this.couple.setLayout(layout);
    this.media.peer.bus()?.send({ type: 'layout', layoutId: layout });
  }

  // ---- shared scene ---------------------------------------------------------------

  /** Live drags apply at once here and go to the partner a few times a second. */
  protected onPlacement(event: PlacementEvent): void {
    const now = performance.now();
    const send = now - this.lastPlacementSentAt > 80;
    if (send) this.lastPlacementSentAt = now;
    this.sceneSync.setPlacement(event.role, event.placement, send);
  }

  protected onPlacementCommit(event: PlacementEvent): void {
    this.lastPlacementSentAt = performance.now();
    this.sceneSync.setPlacement(event.role, event.placement, true);
  }

  protected onBackground(id: string): void {
    this.sceneSync.setBackground(id);
  }

  protected onFx(fx: BackgroundFx): void {
    this.sceneSync.setFx(fx);
  }

  protected onArrange(): void {
    const inputs = this.stage()?.arrangeInputs() ?? [];
    if (inputs.length) this.sceneSync.arrange(inputs);
  }

  protected onFlip(event: { role: PersonRole; flip: boolean }): void {
    const current = this.sceneSync.scene().people[event.role];
    if (current) this.sceneSync.setPlacement(event.role, { ...current, flip: event.flip });
  }

  /** "Your photo": store it here, use it, and send it to the partner once. */
  protected async onUpload(file: File): Promise<void> {
    if (this.importing()) return;
    this.importing.set(true);
    try {
      const stored = await this.backgrounds.importFile(file);
      this.sceneSync.setBackground(stored.id);
      this.toast.show(`Sending your background to ${this.partnerName()}\u2026`, { kind: 'info' });
    } catch (error) {
      this.toast.error(toAppError(error, 'photo-failed'));
    } finally {
      this.importing.set(false);
    }
  }

  protected toggleMic(): void {
    this.camera.setMicEnabled(!this.camera.micEnabled());
  }

  protected leave(): void {
    void this.router.navigateByUrl('/');
  }

  protected startOver(): void {
    this.room.reset();
    void this.router.navigateByUrl('/room/new');
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.repeat) return;
    switch (event.key) {
      case ' ':
        if (this.couple.phase() === 'idle') {
          event.preventDefault();
          this.shutter();
        }
        break;
      case 'f':
      case 'F':
        if (!this.couple.busy()) void this.camera.flip();
        break;
      case 'Escape':
        this.cancelCountdown();
        break;
    }
  }
}
