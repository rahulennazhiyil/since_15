import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { SIGNALING_TRANSPORT, type SignalMessage } from '../signaling/signaling-transport';
import { BlobTransfer } from './blob-transfer';
import { DataChannelBus } from './data-channel';
import { buildRtcConfiguration } from './ice-config';

export type PeerState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface PeerStartOptions {
  selfId: string;
  peerId: string;
  /** The polite peer yields on offer collisions. The guest is polite; the host is not. */
  polite: boolean;
  localStream: MediaStream | null;
}

const DISCONNECT_GRACE_MS = 3000;
const BOOTH_CHANNEL = 'booth';
const BLOB_CHANNEL = 'blobs';

/** RTCSessionDescription is a platform object; transports need a plain, cloneable value. */
function plainSdp(description: RTCSessionDescription): RTCSessionDescriptionInit {
  return { type: description.type, sdp: description.sdp };
}

/**
 * One RTCPeerConnection to the partner, negotiated with the "perfect negotiation"
 * pattern so camera flips and reconnects never glare. Signaling only carries SDP and
 * ICE; the two data channels carry everything the booth does.
 *
 * Start-up handshake: each side announces `peer-ready` once its connection is listening.
 * Tracks and data channels are added only after both sides are ready, so the very first
 * offer is complete and nothing is ever rolled back.
 */
@Injectable({ providedIn: 'root' })
export class PeerConnectionService {
  private readonly transport = inject(SIGNALING_TRANSPORT);

  private pc: RTCPeerConnection | null = null;
  private options: PeerStartOptions | null = null;
  private localStream: MediaStream | null = null;
  private signaling: Subscription | null = null;
  private makingOffer = false;
  private ignoreOffer = false;
  private peerReady = false;
  private armed = false;
  private restarted = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly senders = new Map<string, RTCRtpSender>();

  private readonly _state = signal<PeerState>('idle');
  private readonly _remoteStream = signal<MediaStream | null>(null);
  private readonly _bus = signal<DataChannelBus | null>(null);
  private readonly _blobs = signal<BlobTransfer | null>(null);
  private readonly _channelOpen = signal(false);

  readonly state = this._state.asReadonly();
  readonly remoteStream = this._remoteStream.asReadonly();
  readonly bus = this._bus.asReadonly();
  readonly blobs = this._blobs.asReadonly();
  readonly channelOpen = this._channelOpen.asReadonly();
  readonly isConnected = computed(() => this._state() === 'connected');

  start(options: PeerStartOptions): void {
    this.close();
    this.options = options;
    this.localStream = options.localStream;
    this._state.set('connecting');

    const pc = new RTCPeerConnection(buildRtcConfiguration());
    this.pc = pc;

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) await this.send({ type: 'offer', sdp: plainSdp(pc.localDescription) });
      } catch {
        // A failed offer is retried by the next negotiationneeded or ICE restart.
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) void this.send({ type: 'ice', candidate: candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream && this._remoteStream() !== stream) this._remoteStream.set(stream);
    };

    pc.onconnectionstatechange = () => this.onConnectionState(pc.connectionState);
    pc.ondatachannel = (event) => this.adoptChannel(event.channel);

    this.signaling = this.transport.messages$.subscribe((m) => void this.onSignal(m));
    void this.announceReady();
    if (this.peerReady) this.arm();
  }

  /** Swaps the outgoing camera/mic without renegotiating where the browser allows it. */
  async replaceLocalStream(stream: MediaStream | null): Promise<void> {
    this.localStream = stream;
    if (!this.pc || !this.armed) return;
    if (!stream) {
      for (const sender of this.senders.values()) await sender.replaceTrack(null);
      return;
    }
    for (const track of stream.getTracks()) {
      const sender = this.senders.get(track.kind);
      if (sender) await sender.replaceTrack(track);
      else this.senders.set(track.kind, this.pc.addTrack(track, stream));
    }
  }

  /** Manual retry after a failure. */
  restart(): void {
    if (!this.pc || !this.options) return;
    this._state.set('connecting');
    this.pc.restartIce();
  }

  close(): void {
    this.clearDisconnectTimer();
    this.signaling?.unsubscribe();
    this.signaling = null;
    this._bus()?.close();
    this._blobs()?.close();
    this._bus.set(null);
    this._blobs.set(null);
    this._channelOpen.set(false);
    if (this.pc) {
      this.pc.onnegotiationneeded = null;
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.close();
    }
    this.pc = null;
    this.options = null;
    this.localStream = null;
    this.senders.clear();
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.peerReady = false;
    this.armed = false;
    this.restarted = false;
    this._remoteStream.set(null);
    this._state.set(this._state() === 'idle' ? 'idle' : 'closed');
  }

  private announceReady(): Promise<void> {
    const opts = this.options;
    if (!opts) return Promise.resolve();
    return this.transport.send({ type: 'peer-ready', from: opts.selfId, to: opts.peerId }).catch(() => undefined);
  }

  /** Both sides are listening: add what needs negotiating. The impolite side opens the channels. */
  private arm(): void {
    const pc = this.pc;
    const opts = this.options;
    if (!pc || !opts || this.armed) return;
    this.armed = true;
    if (!opts.polite) {
      this.adoptChannel(pc.createDataChannel(BOOTH_CHANNEL, { ordered: true }));
      this.adoptChannel(pc.createDataChannel(BLOB_CHANNEL, { ordered: true }));
    }
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.senders.set(track.kind, pc.addTrack(track, this.localStream));
      }
    }
  }

  private adoptChannel(channel: RTCDataChannel): void {
    if (channel.label === BOOTH_CHANNEL) {
      const bus = new DataChannelBus(channel);
      bus.open$.subscribe((open) => this._channelOpen.set(open));
      this._bus.set(bus);
    } else if (channel.label === BLOB_CHANNEL) {
      this._blobs.set(new BlobTransfer(channel));
    }
  }

  private async onSignal(message: SignalMessage): Promise<void> {
    const pc = this.pc;
    const opts = this.options;
    if (!pc || !opts) return;
    if (message.type !== 'offer' && message.type !== 'answer' && message.type !== 'ice' && message.type !== 'peer-ready') return;
    if (message.from !== opts.peerId || message.to !== opts.selfId) return;

    try {
      if (message.type === 'peer-ready') {
        const first = !this.peerReady;
        this.peerReady = true;
        if (first) {
          // Our own announcement may have gone out before they listened; say it again.
          await this.announceReady();
          this.arm();
        }
        return;
      }

      if (message.type === 'ice') {
        try {
          await pc.addIceCandidate(message.candidate);
        } catch (error) {
          if (!this.ignoreOffer) throw error;
        }
        return;
      }

      const description = message.sdp;
      const collision = description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable');
      this.ignoreOffer = !opts.polite && collision;
      if (this.ignoreOffer) return;

      await pc.setRemoteDescription(description);
      if (description.type === 'offer') {
        await pc.setLocalDescription();
        if (pc.localDescription) await this.send({ type: 'answer', sdp: plainSdp(pc.localDescription) });
      }
    } catch {
      // Negotiation hiccups resolve on the next round; connection state reports real failure.
    }
  }

  private send(body: { type: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit } | { type: 'ice'; candidate: RTCIceCandidateInit }): Promise<void> {
    const opts = this.options;
    if (!opts) return Promise.resolve();
    const base = { from: opts.selfId, to: opts.peerId };
    const message: SignalMessage =
      body.type === 'ice' ? { ...base, type: 'ice', candidate: body.candidate } : { ...base, type: body.type, sdp: body.sdp };
    return this.transport.send(message).catch(() => undefined);
  }

  private onConnectionState(state: RTCPeerConnectionState): void {
    switch (state) {
      case 'connected':
        this.clearDisconnectTimer();
        this.restarted = false;
        this._state.set('connected');
        break;
      case 'disconnected':
        this._state.set('disconnected');
        this.clearDisconnectTimer();
        this.disconnectTimer = setTimeout(() => {
          if (this.pc?.connectionState === 'disconnected') this.tryRestart();
        }, DISCONNECT_GRACE_MS);
        break;
      case 'failed':
        this.tryRestart();
        break;
      case 'closed':
        this._state.set('closed');
        break;
      default:
        break;
    }
  }

  /** One automatic ICE restart; after that the UI offers a manual retry. */
  private tryRestart(): void {
    if (!this.pc) return;
    if (this.restarted) {
      this._state.set('failed');
      return;
    }
    this.restarted = true;
    this._state.set('disconnected');
    this.pc.restartIce();
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
  }
}
