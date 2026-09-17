import { BehaviorSubject, Subject, Subscription, type Observable } from 'rxjs';
import type { PresenceInfo, SignalMessage, SignalingStatus, SignalingTransport } from './signaling-transport';

/**
 * Defers loading a transport's code until a room is actually joined, so the Supabase
 * client stays out of the initial bundle and out of development builds entirely.
 */
export class LazySignaling implements SignalingTransport {
  private readonly presence = new BehaviorSubject<PresenceInfo[]>([]);
  private readonly messages = new Subject<SignalMessage>();
  private readonly status = new BehaviorSubject<SignalingStatus>('idle');

  readonly presence$: Observable<PresenceInfo[]> = this.presence.asObservable();
  readonly messages$: Observable<SignalMessage> = this.messages.asObservable();
  readonly status$: Observable<SignalingStatus> = this.status.asObservable();

  private inner: Promise<SignalingTransport> | null = null;
  private forwarding = new Subscription();

  constructor(private readonly load: () => Promise<SignalingTransport>) {}

  async join(roomCode: string, self: PresenceInfo): Promise<void> {
    const transport = await this.resolve();
    await transport.join(roomCode, self);
  }

  async leave(): Promise<void> {
    if (!this.inner) return;
    const transport = await this.inner;
    await transport.leave();
  }

  async send(message: SignalMessage): Promise<void> {
    const transport = await this.resolve();
    await transport.send(message);
  }

  private resolve(): Promise<SignalingTransport> {
    this.inner ??= this.load().then((transport) => {
      this.forwarding.add(transport.presence$.subscribe(this.presence));
      this.forwarding.add(transport.messages$.subscribe(this.messages));
      this.forwarding.add(transport.status$.subscribe(this.status));
      return transport;
    });
    return this.inner;
  }
}
