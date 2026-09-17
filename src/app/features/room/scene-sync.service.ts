import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import type { LayoutId } from '../../core/photo/layouts';
import { isCustomBackgroundId } from '../../core/scene/background-catalog';
import {
  DEFAULT_PLACEMENTS,
  DEFAULT_SCENE,
  applyScenePatch,
  autoArrange,
  clampPlacement,
  sceneSizeOf,
  type ArrangeInput,
  type BackgroundFx,
  type PersonRole,
  type Placement,
  type SceneState,
} from '../../core/scene/scene.model';
import { RoomService } from '../../core/room/room.service';
import { BackgroundStore } from '../../core/storage/background-store';
import type { BoothMessage } from '../../core/webrtc/booth-messages';
import { PeerConnectionService } from '../../core/webrtc/peer-connection.service';

/**
 * The room's shared scene. Either person can change it; every change goes out as a
 * small message and the host answers "what is the scene?" when someone (re)connects, so
 * both devices converge. Custom backgrounds travel over the blob channel once.
 */
@Injectable()
export class SceneSync {
  private readonly peer = inject(PeerConnectionService);
  private readonly room = inject(RoomService);
  private readonly backgrounds = inject(BackgroundStore);

  readonly scene = signal<SceneState>(DEFAULT_SCENE);
  /** While a photo is being taken the schedule's snapshot rules; incoming edits wait. */
  readonly locked = signal(false);
  /** Custom background currently being sent to the partner, if any. */
  readonly sharing = signal<string | null>(null);
  /** Custom backgrounds the partner has confirmed. */
  readonly partnerHas = signal<ReadonlySet<string>>(new Set());

  private busSubscription: Subscription | null = null;
  private blobSubscription: Subscription | null = null;

  constructor() {
    effect(() => {
      const bus = this.peer.bus();
      const open = this.peer.channelOpen();
      untracked(() => {
        this.busSubscription?.unsubscribe();
        this.busSubscription = null;
        if (!bus || !open) return;
        this.busSubscription = bus.messages$.subscribe((m) => this.onMessage(m));
        // The host's scene wins on (re)connect; the guest asks, the host also volunteers.
        if (this.room.isHost()) bus.send({ type: 'scene:full', scene: this.scene() });
        else bus.send({ type: 'scene:ask' });
      });
    });

    effect(() => {
      const blobs = this.peer.blobs();
      untracked(() => {
        this.blobSubscription?.unsubscribe();
        this.blobSubscription = blobs
          ? blobs.blobs$.subscribe((received) => {
              if (received.meta['kind'] === 'background') void this.onBackgroundBlob(received.blob, received.meta);
            })
          : null;
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.busSubscription?.unsubscribe();
      this.blobSubscription?.unsubscribe();
    });
  }

  // ---- local edits (applied here, sent to the partner) ---------------------------

  setPlacement(role: PersonRole, placement: Placement, send = true): void {
    const clamped = clampPlacement(placement);
    this.patch({ people: { [role]: clamped } });
    if (send) this.send({ type: 'scene:place', person: role, placement: clamped });
  }

  setBackground(backgroundId: string, fx: BackgroundFx = this.scene().fx): void {
    this.patch({ backgroundId, fx });
    this.send({ type: 'scene:background', backgroundId, fx });
    if (isCustomBackgroundId(backgroundId) && !this.partnerHas().has(backgroundId)) void this.shareBackground(backgroundId);
  }

  setFx(fx: BackgroundFx): void {
    this.setBackground(this.scene().backgroundId, fx);
  }

  setFront(front: PersonRole): void {
    this.patch({ front });
    this.send({ type: 'scene:front', front });
  }

  setFrame(layoutId: LayoutId): void {
    this.patch({ layoutId });
    this.send({ type: 'scene:frame', layoutId });
  }

  /** Computes placements once, here, and sends the result so both devices agree. */
  arrange(inputs: ArrangeInput[]): void {
    const placed = autoArrange(inputs, sceneSizeOf(this.scene().layoutId));
    for (const [role, placement] of Object.entries(placed) as [PersonRole, Placement][]) this.setPlacement(role, placement);
  }

  swapSides(): void {
    const { host, guest } = this.scene().people;
    const h = host ?? DEFAULT_PLACEMENTS.host;
    const g = guest ?? DEFAULT_PLACEMENTS.guest;
    this.setPlacement('host', { ...h, x: g.x });
    this.setPlacement('guest', { ...g, x: h.x });
  }

  resetPlacements(): void {
    this.setPlacement('host', DEFAULT_PLACEMENTS.host);
    this.setPlacement('guest', DEFAULT_PLACEMENTS.guest);
    this.setFront(DEFAULT_SCENE.front);
  }

  /** Adopt a complete scene (the capture schedule's snapshot, or the host's answer). */
  applyFull(scene: SceneState): void {
    this.scene.set(applyScenePatch(scene, {}));
  }

  // ---- incoming ------------------------------------------------------------------

  private onMessage(m: BoothMessage): void {
    switch (m.type) {
      case 'scene:ask':
        if (this.room.isHost()) this.send({ type: 'scene:full', scene: this.scene() });
        break;
      case 'scene:full':
        if (!this.room.isHost() && !this.locked()) this.applyFull(m.scene);
        break;
      case 'scene:place':
        if (!this.locked()) this.patch({ people: { [m.person]: m.placement } });
        break;
      case 'scene:background':
        if (!this.locked()) this.patch({ backgroundId: m.backgroundId, fx: m.fx });
        break;
      case 'scene:front':
        if (!this.locked()) this.patch({ front: m.front });
        break;
      case 'scene:frame':
        if (!this.locked()) this.patch({ layoutId: m.layoutId as LayoutId });
        break;
      case 'scene:bg-ready':
        this.partnerHas.update((set) => new Set([...set, m.id]));
        if (this.sharing() === m.id) this.sharing.set(null);
        break;
      default:
        break;
    }
  }

  private async onBackgroundBlob(blob: Blob, meta: Record<string, string | number | boolean>): Promise<void> {
    const id = String(meta['id'] ?? '');
    if (!isCustomBackgroundId(id)) return;
    try {
      await this.backgrounds.saveFromPartner(id, blob, Number(meta['width']) || 0, Number(meta['height']) || 0);
      this.send({ type: 'scene:bg-ready', id });
      // Re-emit the scene so a stage already showing this id picks the image up.
      if (this.scene().backgroundId === id) this.scene.update((s) => ({ ...s }));
    } catch {
      // Could not store it; the scene shows a plain surface instead.
    }
  }

  private async shareBackground(id: string): Promise<void> {
    const blobs = this.peer.blobs();
    const blob = await this.backgrounds.getBlob(id);
    if (!blobs || !blob) return;
    const meta = this.backgrounds.items().find((b) => b.id === id);
    this.sharing.set(id);
    try {
      await blobs.send(blob, { kind: 'background', id, width: meta?.width ?? 0, height: meta?.height ?? 0 });
    } catch {
      this.sharing.set(null);
    }
  }

  private patch(patch: Partial<SceneState>): void {
    this.scene.update((scene) => applyScenePatch(scene, patch));
  }

  private send(message: BoothMessage): void {
    this.peer.bus()?.send(message);
  }
}
