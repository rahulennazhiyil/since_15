import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { uid } from '../../shared/utils/id';
import { AppError } from '../errors/app-error';
import { ProfileService } from '../profile/profile.service';
import {
  SIGNALING_TRANSPORT,
  type PresenceInfo,
  type SignalMessage,
} from '../signaling/signaling-transport';
import { generateRoomCode, isValidRoomCode } from './room-code';
import type { Participant, Room, RoomStatus } from './room.model';

/**
 * Room lifecycle and presence. The host is authoritative: it enforces capacity and
 * ends the room when it leaves. Media (Phase 6) layers on top of this service.
 */
@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly transport = inject(SIGNALING_TRANSPORT);
  private readonly profile = inject(ProfileService);
  private readonly document = inject(DOCUMENT, { optional: true });

  private readonly _room = signal<Room | null>(null);
  private readonly _status = signal<RoomStatus>('idle');
  private readonly _self = signal<Participant | null>(null);
  private readonly _error = signal<AppError | null>(null);
  /** Set once the partner has been seen at least once in this room. */
  private everConnected = false;

  private subscriptions = new Subscription();
  private lookupTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  readonly room = this._room.asReadonly();
  readonly status = this._status.asReadonly();
  readonly self = this._self.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isHost = computed(() => this._self()?.role === 'host');
  readonly participants = computed(() => this._room()?.participants ?? []);
  readonly partner = computed(() => this.participants().find((p) => p.id !== this._self()?.id) ?? null);
  readonly inRoom = computed(() => this._room() !== null && !['ended', 'not-found', 'full', 'idle'].includes(this._status()));

  /** Fired when a status change deserves a spoken announcement or toast. */
  readonly lastEvent = signal<'partner-joined' | 'partner-left' | null>(null);

  constructor() {
    const win = this.document?.defaultView;
    const onPageHide = (): void => void this.leave();
    win?.addEventListener('pagehide', onPageHide);
    inject(DestroyRef, { optional: true })?.onDestroy(() => {
      win?.removeEventListener('pagehide', onPageHide);
      void this.leave();
    });
  }

  /** Creates a room and waits in it as host. Returns the code. */
  async create(): Promise<string> {
    await this.leave();
    const code = generateRoomCode();
    const self = this.buildSelf('host');
    this.enter(code, self, self.id);
    this._status.set('waiting');
    await this.transport.join(code, self);
    this.armIdleTimer();
    return code;
  }

  /** Joins an existing room as guest. Resolves once a decision is made (connected or not). */
  async join(rawCode: string): Promise<void> {
    await this.leave();
    const code = rawCode.toUpperCase();
    if (!isValidRoomCode(code)) {
      this._status.set('not-found');
      this._error.set(new AppError('invalid-room-code'));
      return;
    }
    const self = this.buildSelf('guest');
    this.enter(code, self, '');
    this._status.set('looking');
    await this.transport.join(code, self);
    this.lookupTimer = setTimeout(() => {
      if (this._status() === 'looking') this.fail('not-found');
    }, environment.room.joinLookupTimeoutMs);
  }

  async leave(): Promise<void> {
    this.clearTimers();
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    if (this._room() && this.isHost() && this._self()) {
      try {
        await this.transport.send({ type: 'room-ended', from: this._self()!.id });
      } catch {
        // Leaving anyway.
      }
    }
    await this.transport.leave();
    this._room.set(null);
    this._self.set(null);
    this.everConnected = false;
    if (!['ended', 'not-found', 'full'].includes(this._status())) this._status.set('idle');
  }

  /** Clears a terminal state so the UI can start over. */
  reset(): void {
    this._status.set('idle');
    this._error.set(null);
    this.lastEvent.set(null);
  }

  private enter(code: string, self: Participant, hostId: string): void {
    this._error.set(null);
    this.lastEvent.set(null);
    this._self.set(self);
    this._room.set({ code, hostId, participants: [self], createdAt: Date.now() });
    this.subscriptions.add(this.transport.presence$.subscribe((list) => this.onPresence(list)));
    this.subscriptions.add(this.transport.messages$.subscribe((m) => this.onMessage(m)));
  }

  private buildSelf(role: Participant['role']): Participant {
    const p = this.profile.profile();
    return {
      id: uid('p'),
      name: p.name.trim() || 'Someone',
      emoji: p.emoji,
      color: p.color,
      role,
      joinedAt: Date.now(),
    };
  }

  private onPresence(list: PresenceInfo[]): void {
    const room = this._room();
    const self = this._self();
    if (!room || !self) return;

    const participants: Participant[] = list.map((p) => ({ ...p }));
    const host = participants.find((p) => p.role === 'host');
    const others = participants.filter((p) => p.id !== self.id);

    this._room.set({ ...room, participants, hostId: host?.id ?? room.hostId });

    if (self.role === 'host') {
      this.hostPresence(others);
    } else {
      this.guestPresence(host, participants);
    }
  }

  private hostPresence(others: Participant[]): void {
    const max = environment.room.maxParticipants;
    if (others.length + 1 > max) {
      // Newest arrivals beyond capacity are turned away; the earliest guest stays.
      const sorted = [...others].sort((a, b) => a.joinedAt - b.joinedAt);
      for (const extra of sorted.slice(max - 1)) {
        void this.transport.send({ type: 'room-full', from: this._self()!.id, to: extra.id });
      }
    }
    const guests = others.slice(0, max - 1);
    if (guests.length > 0) {
      this.clearIdleTimer();
      if (this._status() !== 'connected') {
        this._status.set('connected');
        this.everConnected = true;
        this.lastEvent.set('partner-joined');
      }
    } else if (this.everConnected && this._status() === 'connected') {
      this._status.set('disconnected');
      this.lastEvent.set('partner-left');
      this.armIdleTimer();
    }
  }

  private guestPresence(host: Participant | undefined, participants: Participant[]): void {
    const status = this._status();
    if (status === 'looking') {
      if (!host) return;
      this.clearLookupTimer();
      if (participants.length > environment.room.maxParticipants) {
        // The host will also tell us, but do not make the newcomer wait for it.
        const byJoin = [...participants].sort((a, b) => a.joinedAt - b.joinedAt);
        const ours = byJoin.findIndex((p) => p.id === this._self()?.id);
        if (ours >= environment.room.maxParticipants) {
          this.fail('full');
          return;
        }
      }
      this._status.set('connected');
      this.everConnected = true;
      this.lastEvent.set('partner-joined');
      return;
    }
    if ((status === 'connected' || status === 'reconnecting') && !host) {
      this.end('ended');
    }
  }

  private onMessage(message: SignalMessage): void {
    switch (message.type) {
      case 'room-full':
        this.fail('full');
        break;
      case 'room-ended':
        if (!this.isHost()) this.end('ended');
        break;
      default:
        // offer / answer / ice are consumed by the peer connection (Phase 6).
        break;
    }
  }

  private fail(status: 'not-found' | 'full'): void {
    this._status.set(status);
    this._error.set(new AppError(status === 'full' ? 'room-full' : 'room-not-found'));
    void this.leave();
  }

  private end(status: 'ended'): void {
    this._status.set(status);
    this._error.set(new AppError('room-ended'));
    void this.leave();
  }

  /** A host alone for too long closes the room so codes never linger. */
  private armIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.isHost() && this._status() !== 'connected') {
        this._status.set('ended');
        this._error.set(new AppError('room-ended'));
        void this.leave();
      }
    }, environment.room.hostIdleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private clearLookupTimer(): void {
    if (this.lookupTimer) clearTimeout(this.lookupTimer);
    this.lookupTimer = null;
  }

  private clearTimers(): void {
    this.clearIdleTimer();
    this.clearLookupTimer();
  }
}
