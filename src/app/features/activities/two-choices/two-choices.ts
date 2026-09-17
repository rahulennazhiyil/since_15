import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { Button } from '../../../shared/ui/button';
import { ActivityChannel, isAsk, type AskPayload } from '../activity-channel';
import type { ActivityId } from '../activity.model';
import { newRound, nextIndex, recordPick, roundMatched, roundRevealed, type Pick } from '../activity-logic';
import { THIS_OR_THAT, WOULD_YOU_RATHER, type TwoChoice } from '../content';

type Deck = 'this-or-that' | 'would-you-rather';
type Payload = { kind: 'pick'; index: number; pick: Pick } | { kind: 'next'; index: number } | AskPayload;

const isPayload = (v: unknown): v is Payload => {
  if (isAsk(v)) return true;
  const p = v as Exclude<Payload, AskPayload>;
  return !!p && (p.kind === 'pick' ? typeof p.index === 'number' && (p.pick === 'a' || p.pick === 'b') : p.kind === 'next' && typeof p.index === 'number');
};

/** One component, two decks: "This or that" and "Would you rather". */
@Component({
  selector: 'app-two-choices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    <p class="eyebrow">Round {{ round().index + 1 }}</p>
    <div class="choices">
      @for (side of ['a', 'b']; track side) {
        <button
          type="button"
          class="choice"
          [class.mine]="round().picks.self === side"
          [class.theirs]="revealed() && round().picks.partner === side"
          [disabled]="round().picks.self !== undefined"
          (click)="pick(side === 'a' ? 'a' : 'b')"
        >
          <span class="text">{{ side === 'a' ? card().a : card().b }}</span>
          @if (revealed()) {
            <span class="who">
              @if (round().picks.self === side) { You }
              @if (round().picks.self === side && round().picks.partner === side) { &amp; }
              @if (round().picks.partner === side) { Them }
            </span>
          } @else if (round().picks.self === side) {
            <span class="who">You</span>
          }
        </button>
      }
    </div>

    <p class="status">
      @if (revealed()) {
        @if (matched()) { Same answer <span aria-hidden="true">❤️</span> } @else { Different, and that's the fun part. }
      } @else if (round().picks.self) {
        @if (channel.connected()) { Waiting for your person… } @else { Your person will see this when they join. }
      } @else {
        Pick one, no thinking.
      }
    </p>

    <button appButton variant="secondary" (click)="next()" [disabled]="!round().picks.self">Next round</button>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }
    .choices {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
    .choice {
      display: grid;
      gap: var(--space-2);
      align-content: center;
      min-height: 8rem;
      padding: var(--space-4);
      border-radius: var(--radius-xl);
      background: var(--surface-2);
      border: 2px solid transparent;
      text-align: center;
      transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
    }
    .choice:not(:disabled):hover {
      transform: translateY(-2px);
    }
    .choice.mine {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .choice.theirs {
      box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text-muted);
    }
    .text {
      font-weight: 700;
      font-size: var(--text-lg);
    }
    .who {
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .status {
      min-height: 1.5rem;
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
  `,
})
export class TwoChoices {
  readonly deck = input<Deck>('this-or-that');

  protected readonly channel = inject(ActivityChannel);
  protected readonly round = signal(newRound(0));

  private readonly cards = computed<readonly TwoChoice[]>(() => (this.deck() === 'this-or-that' ? THIS_OR_THAT : WOULD_YOU_RATHER));
  protected readonly card = computed(() => this.cards()[this.round().index % this.cards().length]);
  protected readonly revealed = computed(() => roundRevealed(this.round()));
  protected readonly matched = computed(() => roundMatched(this.round()));
  private subscription: Subscription | null = null;

  constructor() {
    effect(() => {
      const activity = this.deck() as ActivityId;
      untracked(() => {
        this.subscription?.unsubscribe();
        this.subscription = this.channel.on(activity, isPayload).subscribe((p) => this.onMessage(p));
      });
    });
    this.channel.requestStateOnConnect(this.deck() as ActivityId);
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  protected pick(choice: Pick): void {
    this.round.update((r) => recordPick(r, 'self', choice));
    this.channel.send(this.deck(), { kind: 'pick', index: this.round().index, pick: choice } satisfies Payload);
  }

  protected next(): void {
    const index = nextIndex(this.round().index, this.cards().length);
    this.round.set(newRound(index));
    this.channel.send(this.deck(), { kind: 'next', index } satisfies Payload);
  }

  private onMessage(p: Payload): void {
    if (isAsk(p)) {
      if (this.channel.isHost()) this.channel.send(this.deck(), { kind: 'next', index: this.round().index });
      return;
    }
    if (p.kind === 'next') {
      this.round.set(newRound(p.index));
      return;
    }
    if (p.index !== this.round().index) return;
    this.round.update((r) => recordPick(r, 'partner', p.pick));
  }
}
