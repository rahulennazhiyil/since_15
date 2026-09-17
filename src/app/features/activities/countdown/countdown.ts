import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StorageService, type StorageKeyDef } from '../../../core/storage/storage.service';
import { Button } from '../../../shared/ui/button';
import { ActivityChannel, isAsk, type AskPayload } from '../activity-channel';
import { describeRemaining, remainingUntil } from '../activity-logic';

interface Target {
  label: string;
  /** Local date as yyyy-mm-dd. */
  date: string;
}

const STORAGE: StorageKeyDef<Target | null> = { key: 'countdown', version: 1, defaults: () => null };
const MAX_LABEL = 40;

const isPayload = (v: unknown): v is Target | AskPayload => isAsk(v) || isTarget(v);
const isTarget = (v: unknown): v is Target =>
  !!v && typeof (v as Target).label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test((v as Target).date ?? '');

function toTimestamp(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0).getTime();
}

/** Days until the next visit, birthday or anniversary. Shared with the partner when set. */
@Component({
  selector: 'app-countdown-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    @if (target(); as t) {
      <div class="hero">
        <p class="eyebrow">{{ t.label }}</p>
        <p class="big">{{ remaining().past ? '·' : remaining().days }}</p>
        <p class="lead">{{ description() }}</p>
        <p class="small muted">{{ dateText() }}</p>
      </div>
      <div class="row">
        <button appButton variant="secondary" size="sm" (click)="editing.set(true)">Change</button>
        <button appButton variant="ghost" size="sm" (click)="clear()">Remove</button>
      </div>
    }

    @if (!target() || editing()) {
      <form class="form" (submit)="save($event)">
        <label>
          <span class="eyebrow">What are we counting down to?</span>
          <input type="text" placeholder="Next visit, anniversary, a trip…" [value]="label()" [attr.maxlength]="maxLabel" (input)="label.set($any($event.target).value)" required />
        </label>
        <label>
          <span class="eyebrow">When?</span>
          <input type="date" [value]="date()" (input)="date.set($any($event.target).value)" required />
        </label>
        <div class="row">
          <button appButton type="submit" [disabled]="!label().trim() || !date()">Save</button>
          @if (target()) {
            <button appButton variant="ghost" type="button" (click)="editing.set(false)">Cancel</button>
          }
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }
    .hero {
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      padding: var(--space-6);
      border-radius: var(--radius-xl);
      background: var(--accent-soft);
      text-align: center;
    }
    .big {
      font-family: var(--font-display);
      font-style: italic;
      font-size: clamp(4rem, 18vw, 6rem);
      line-height: 1;
      color: var(--accent-strong);
    }
    .form {
      display: grid;
      gap: var(--space-3);
    }
    label {
      display: grid;
      gap: var(--space-2);
    }
    input {
      min-height: var(--tap);
      padding: 0 var(--space-4);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
    }
    .row {
      display: flex;
      gap: var(--space-2);
      justify-content: center;
    }
  `,
})
export class CountdownActivity {
  private readonly channel = inject(ActivityChannel);
  private readonly storage = inject(StorageService);

  protected readonly maxLabel = MAX_LABEL;
  protected readonly target = signal<Target | null>(this.storage.read(STORAGE));
  protected readonly editing = signal(false);
  protected readonly label = signal(this.target()?.label ?? '');
  protected readonly date = signal(this.target()?.date ?? '');
  private readonly now = signal(Date.now());

  protected readonly remaining = computed(() => remainingUntil(toTimestamp(this.target()?.date ?? '1970-01-01'), this.now()));
  protected readonly description = computed(() => describeRemaining(this.remaining()));
  protected readonly dateText = computed(() => {
    const t = this.target();
    return t ? new Date(toTimestamp(t.date)).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  });

  constructor() {
    effect(() => this.storage.write(STORAGE, this.target()));
    effect(() => {
      if (this.channel.connected()) untracked(() => this.share());
    });
    const tick = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    this.channel
      .on('countdown', isPayload)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((t) => {
        if (isAsk(t)) {
          if (this.channel.isHost()) this.share();
          return;
        }
        this.target.set({ label: t.label.slice(0, MAX_LABEL), date: t.date });
        this.editing.set(false);
      });
    this.channel.requestStateOnConnect('countdown');
  }

  protected save(event: Event): void {
    event.preventDefault();
    const label = this.label().trim();
    if (!label || !this.date()) return;
    this.target.set({ label, date: this.date() });
    this.editing.set(false);
    this.share();
  }

  protected clear(): void {
    this.target.set(null);
    this.label.set('');
    this.date.set('');
  }

  private share(): void {
    const t = this.target();
    if (t) this.channel.send('countdown', t);
  }
}
