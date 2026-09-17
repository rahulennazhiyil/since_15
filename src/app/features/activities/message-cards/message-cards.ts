import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProfileService } from '../../../core/profile/profile.service';
import { Button } from '../../../shared/ui/button';
import { Icon } from '../../../shared/ui/icon';
import { uid } from '../../../shared/utils/id';
import { ActivityChannel, isAsk } from '../activity-channel';
import { MESSAGE_CARD_STYLES, type MessageCardStyle } from '../content';

interface Card {
  id: string;
  text: string;
  style: MessageCardStyle;
  from: string;
  mine: boolean;
}

type Payload = Omit<Card, 'mine'>;
const MAX_LENGTH = 140;

const isPayload = (v: unknown): v is Payload => {
  if (isAsk(v)) return false;
  const p = v as Payload;
  return !!p && typeof p.id === 'string' && typeof p.text === 'string' && typeof p.from === 'string' && (MESSAGE_CARD_STYLES as readonly string[]).includes(p.style);
};

/** Tiny notes that fly across. Kept for the session only, on purpose. */
@Component({
  selector: 'app-message-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon],
  template: `
    <form class="compose" (submit)="send($event)">
      <textarea
        rows="2"
        placeholder="Write something small and true…"
        [value]="text()"
        [attr.maxlength]="maxLength"
        aria-label="Your note"
        (input)="text.set($any($event.target).value)"
      ></textarea>
      <div class="row">
        <div class="styles" role="radiogroup" aria-label="Card style">
          @for (s of styles; track s) {
            <button type="button" role="radio" class="swatch" [attr.data-style]="s" [class.on]="s === style()" [attr.aria-checked]="s === style()" [attr.aria-label]="'Style ' + s" (click)="style.set(s)"></button>
          }
        </div>
        <button appButton size="sm" type="submit" [disabled]="!text().trim()"><app-icon name="share" [size]="16" /> Send</button>
      </div>
    </form>

    @if (cards().length === 0) {
      <p class="small muted">Nothing yet. The first note is the hardest.</p>
    }
    <ul class="stack">
      @for (c of cards(); track c.id) {
        <li class="note" [attr.data-style]="c.style" [class.mine]="c.mine">
          <p>{{ c.text }}</p>
          <span class="from">{{ c.mine ? 'you' : c.from }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
    }
    .compose {
      display: grid;
      gap: var(--space-2);
    }
    textarea {
      width: 100%;
      resize: none;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .styles {
      display: flex;
      gap: var(--space-2);
    }
    .swatch {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      border: 2px solid transparent;
    }
    .swatch.on {
      border-color: var(--text);
    }
    [data-style='soft'] {
      background: linear-gradient(135deg, #f6d9d2, #ead1e3);
      color: #2b2622;
    }
    [data-style='night'] {
      background: linear-gradient(135deg, #2f2a3d, #4d3f63);
      color: #f2eef7;
    }
    [data-style='sun'] {
      background: linear-gradient(135deg, #ffe1a8, #f7b267);
      color: #3a2a12;
    }
    .stack {
      --stack-gap: var(--space-2);
    }
    .note {
      position: relative;
      padding: var(--space-4) var(--space-5) var(--space-6);
      border-radius: var(--radius-lg);
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-xl);
      line-height: 1.25;
      animation: rise-in var(--dur-slow) var(--ease-out) both;
    }
    .note.mine {
      margin-left: var(--space-8);
    }
    .note:not(.mine) {
      margin-right: var(--space-8);
    }
    .from {
      position: absolute;
      right: var(--space-4);
      bottom: var(--space-2);
      font-family: var(--font-ui);
      font-style: normal;
      font-size: var(--text-xs);
      font-weight: 700;
      opacity: 0.7;
    }
  `,
})
export class MessageCards {
  private readonly channel = inject(ActivityChannel);
  private readonly profile = inject(ProfileService);

  protected readonly styles = MESSAGE_CARD_STYLES;
  protected readonly maxLength = MAX_LENGTH;
  protected readonly text = signal('');
  protected readonly style = signal<MessageCardStyle>('soft');
  protected readonly cards = signal<Card[]>([]);

  constructor() {
    this.channel
      .on('message-cards', isPayload)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((p) => this.cards.update((list) => [{ ...p, text: p.text.slice(0, MAX_LENGTH), mine: false }, ...list]));
  }

  protected send(event: Event): void {
    event.preventDefault();
    const text = this.text().trim();
    if (!text) return;
    const payload: Payload = { id: uid('note'), text, style: this.style(), from: this.profile.profile().name || 'Someone' };
    this.channel.send('message-cards', payload);
    this.cards.update((list) => [{ ...payload, mine: true }, ...list]);
    this.text.set('');
  }
}
