import { BehaviorSubject, Subject, type Observable } from 'rxjs';
import { parseBoothMessage, type BoothMessage } from './booth-messages';

/** Typed JSON messaging over one RTCDataChannel. */
export class DataChannelBus {
  private readonly messages = new Subject<BoothMessage>();
  private readonly open = new BehaviorSubject<boolean>(false);

  readonly messages$: Observable<BoothMessage> = this.messages.asObservable();
  readonly open$: Observable<boolean> = this.open.asObservable();

  constructor(private readonly channel: RTCDataChannel) {
    channel.onopen = () => this.open.next(true);
    channel.onclose = () => this.open.next(false);
    channel.onmessage = (event) => {
      const message = parseBoothMessage(event.data);
      if (message) this.messages.next(message);
    };
    if (channel.readyState === 'open') this.open.next(true);
  }

  get isOpen(): boolean {
    return this.channel.readyState === 'open';
  }

  /** Returns false when the channel is not open; callers decide whether that matters. */
  send(message: BoothMessage): boolean {
    if (this.channel.readyState !== 'open') return false;
    this.channel.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.channel.onopen = null;
    this.channel.onclose = null;
    this.channel.onmessage = null;
    if (this.channel.readyState === 'open' || this.channel.readyState === 'connecting') this.channel.close();
    this.open.next(false);
    this.messages.complete();
  }
}
