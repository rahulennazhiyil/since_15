import { Subject, Subscription, type Observable } from 'rxjs';
import { uid } from '../../shared/utils/id';
import type { BoothMessage } from '../webrtc/booth-messages';
import type { DataChannelBus } from '../webrtc/data-channel';
import type { BoothMode } from './booth-session';

export interface CaptureRequest {
  mode: BoothMode;
  shots: number;
  intervalMs: number;
  countdownMs: number;
}

/** What both peers agree to do. `fireAt` is on the host's clock. */
export interface CaptureSchedule extends CaptureRequest {
  captureId: string;
  fireAt: number;
  filterId: string;
  layoutId: string;
}

export interface CoordinatorDeps {
  bus: () => DataChannelBus | null;
  isHost: () => boolean;
  /** Current local time in ms (performance.timeOrigin + now). */
  now: () => number;
  /** Local -> host clock. Identity on the host. */
  toHostTime: (localTime: number) => number;
  /** The shared settings at the moment of scheduling. */
  currentFilterId: () => string;
  currentLayoutId: () => string;
}

/** Network head start so both sides see the full countdown even with a slow link. */
const SCHEDULE_LEAD_MS = 350;

/**
 * Host-authoritative capture protocol over the booth data channel.
 *
 *   either side: capture:request  -> host: capture:scheduled -> both run the schedule
 *   either side: capture:cancel   -> both stop
 */
export class CaptureCoordinator {
  private readonly scheduled = new Subject<CaptureSchedule>();
  private readonly cancelled = new Subject<string>();
  private subscription: Subscription | null = null;

  readonly scheduled$: Observable<CaptureSchedule> = this.scheduled.asObservable();
  readonly cancelled$: Observable<string> = this.cancelled.asObservable();

  constructor(private readonly deps: CoordinatorDeps) {}

  /** Start listening on the current bus. Call again when the bus changes. */
  attach(): void {
    this.detach();
    const bus = this.deps.bus();
    if (!bus) return;
    this.subscription = bus.messages$.subscribe((m) => this.onMessage(m));
  }

  detach(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  /** Press the shutter. Host schedules directly; guest asks the host to. */
  request(params: CaptureRequest): void {
    if (this.deps.isHost()) {
      this.schedule(params);
      return;
    }
    this.deps.bus()?.send({ type: 'capture:request', ...params });
  }

  cancel(captureId: string): void {
    this.deps.bus()?.send({ type: 'capture:cancel', captureId });
    this.cancelled.next(captureId);
  }

  /** Without a partner (channel closed) the schedule still runs locally. */
  private schedule(params: CaptureRequest): void {
    const schedule: CaptureSchedule = {
      ...params,
      captureId: uid('cap'),
      fireAt: this.deps.toHostTime(this.deps.now()) + params.countdownMs + SCHEDULE_LEAD_MS,
      filterId: this.deps.currentFilterId(),
      layoutId: this.deps.currentLayoutId(),
    };
    this.deps.bus()?.send({ type: 'capture:scheduled', ...schedule, mode: schedule.mode });
    this.scheduled.next(schedule);
  }

  private onMessage(m: BoothMessage): void {
    switch (m.type) {
      case 'capture:request':
        if (this.deps.isHost()) {
          this.schedule({ mode: m.mode as BoothMode, shots: m.shots, intervalMs: m.intervalMs, countdownMs: m.countdownMs });
        }
        break;
      case 'capture:scheduled':
        if (!this.deps.isHost()) {
          this.scheduled.next({
            captureId: m.captureId,
            fireAt: m.fireAt,
            shots: m.shots,
            intervalMs: m.intervalMs,
            countdownMs: 0,
            mode: m.mode as BoothMode,
            filterId: m.filterId,
            layoutId: m.layoutId,
          });
        }
        break;
      case 'capture:cancel':
        this.cancelled.next(m.captureId);
        break;
      default:
        break;
    }
  }
}
