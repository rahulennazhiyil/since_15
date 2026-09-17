import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../../shared/ui/button';
import { Icon } from '../../../shared/ui/icon';
import { ActivityChannel, isAsk, type AskPayload } from '../activity-channel';
import { nextIndex } from '../activity-logic';
import { QUESTION_CARDS } from '../content';

interface Card {
  index: number;
}
type Payload = Card | AskPayload;

const isPayload = (v: unknown): v is Payload => isAsk(v) || typeof (v as Card)?.index === 'number';

@Component({
  selector: 'app-question-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon],
  template: `
    <div class="card" [attr.data-n]="index()">
      <p class="eyebrow">Card {{ index() + 1 }} of {{ total }}</p>
      <p class="question">{{ question() }}</p>
    </div>
    <div class="row">
      <button appButton (click)="next()"><app-icon name="retry" [size]="18" /> Next card</button>
      @if (channel.connected()) {
        <span class="small muted">You both see the same card</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }
    .card {
      display: grid;
      gap: var(--space-3);
      min-height: 11rem;
      padding: var(--space-6);
      border-radius: var(--radius-xl);
      background: var(--accent-soft);
      color: var(--text);
      animation: scale-in var(--dur-slow) var(--ease-out) both;
    }
    .question {
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-2xl);
      line-height: 1.2;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }
  `,
})
export class QuestionCards {
  protected readonly channel = inject(ActivityChannel);
  protected readonly total = QUESTION_CARDS.length;
  protected readonly index = signal(Math.floor(Math.random() * QUESTION_CARDS.length));
  protected readonly question = computed(() => QUESTION_CARDS[this.index()]);

  constructor() {
    this.channel
      .on('question-cards', isPayload)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((p) => {
        if (isAsk(p)) {
          if (this.channel.isHost()) this.channel.send('question-cards', { index: this.index() } satisfies Card);
          return;
        }
        this.index.set(((p.index % this.total) + this.total) % this.total);
      });
    this.channel.requestStateOnConnect('question-cards');
  }

  protected next(): void {
    const index = nextIndex(this.index(), this.total);
    this.index.set(index);
    this.channel.send('question-cards', { index } satisfies Card);
  }
}
