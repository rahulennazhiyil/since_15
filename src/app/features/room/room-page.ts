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
import { ERROR_COPY } from '../../core/errors/error-copy';
import { FilterCatalog } from '../../core/filters/filter-catalog.service';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { THUMBNAIL_EDGE, ThumbnailSource } from '../../core/filters/thumbnail-source';
import { LAYOUTS, PAIR_LAYOUT_CHOICES, type LayoutId } from '../../core/photo/layouts';
import { ProfileService } from '../../core/profile/profile.service';
import { RoomService } from '../../core/room/room.service';
import { Announcer } from '../../shared/a11y/announcer.service';
import { Button } from '../../shared/ui/button';
import { Chip } from '../../shared/ui/chip';
import { IconButton } from '../../shared/ui/icon-button';
import { Sheet } from '../../shared/ui/sheet';
import { Spinner } from '../../shared/ui/spinner';
import { ActivityHost } from '../activities/activity-host';
import { ToastService } from '../../shared/ui/toast.service';
import { CustomFilterStore } from '../../core/storage/custom-filter-store';
import { uid } from '../../shared/utils/id';
import type { PhotoMeta } from '../../core/storage/photo-store';
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
import { IdentityForm } from '../profile/identity-form';
import { ParticipantView } from './participant-view';
import { RoomHeader } from './room-header';
import { RoomMediaService } from './room-media.service';
import { RoomWaiting } from './room-waiting';

const THUMBNAIL_REFRESH_MS = 3000;
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
  providers: [RoomMediaService, CoupleSession],
  imports: [
    RouterLink,
    Button,
    Chip,
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
  protected readonly catalog = inject(FilterCatalog);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly announcer = inject(Announcer);
  private readonly router = inject(Router);

  private readonly localView = viewChild(CameraView);
  private readonly partnerView = viewChild(ParticipantView);

  /** True once the user has passed the identity gate (or already had one). */
  protected readonly identified = signal(false);
  protected readonly starting = signal(false);
  protected readonly countdown = signal<CountdownSeconds>(3);
  protected readonly thumbs = new ThumbnailSource();
  /** Groups this visit's photos on the memory wall. */
  protected readonly sessionId = uid('s');
  protected readonly viewing = signal<PhotoMeta | null>(null);
  protected readonly activitiesOpen = signal(false);

  protected readonly normalizedCode = computed(() => this.code().toUpperCase());
  protected readonly terminal = computed(() => ['ended', 'not-found', 'full'].includes(this.room.status()));
  protected readonly terminalCopy = computed(() => {
    const err = this.room.error();
    return err ? err.userMessage : ERROR_COPY['room-ended'];
  });
  protected readonly canShoot = computed(() => this.room.status() === 'connected' && this.media.peer.isConnected() && !this.couple.busy());
  protected readonly layoutChoices = PAIR_LAYOUT_CHOICES.map((id) => ({ id, name: LAYOUTS[id].name }));
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
      const blobs = this.media.peer.blobs();
      untracked(() => {
        if (!local) return;
        this.couple.bind({
          grabLocal: () => local.grabFrame(environment.photo.maxLongEdge),
          grabRemote: () => (partner ? partner.grabFrame(environment.photo.maxLongEdge) : Promise.reject(new Error('no partner view'))),
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
      void this.couple.run(schedule);
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

    // Filter thumbnails follow the live camera while shooting; pause on the reveal.
    effect(() => {
      const view = this.localView();
      const live = this.camera.isLive();
      const reviewing = this.couple.phase() === 'review';
      if (view && live && !reviewing) this.thumbs.start(() => view.grabFrame(THUMBNAIL_EDGE), THUMBNAIL_REFRESH_MS);
      else this.thumbs.stop();
    });

    inject(DestroyRef).onDestroy(() => {
      this.coordinator.detach();
      this.busSubscription?.unsubscribe();
      this.thumbs.dispose();
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
    this.couple.setLayout(layout);
    this.media.peer.bus()?.send({ type: 'layout', layoutId: layout });
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
