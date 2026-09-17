import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PROFILE_COLORS, VIBE_EMOJIS } from '../../core/profile/profile.model';
import { ProfileService } from '../../core/profile/profile.service';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';

const MAX_NAME = 24;

/** Name, vibe emoji and colour. Saves to the profile on submit; no account involved. */
@Component({
  selector: 'app-identity-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button],
  template: `
    <form (submit)="submit($event)" class="stack" style="--stack-gap: var(--space-6)">
      <div class="who">
        <app-avatar [emoji]="emoji()" [color]="color()" [name]="name() || 'You'" size="lg" />
        <label class="field">
          <span class="eyebrow">What's your name?</span>
          <input
            type="text"
            autocomplete="nickname"
            [attr.maxlength]="maxName"
            placeholder="Your name"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
            required
          />
        </label>
      </div>

      <fieldset>
        <legend class="eyebrow">Choose your vibe</legend>
        <div class="emoji" role="radiogroup" aria-label="Vibe">
          @for (e of emojis; track e) {
            <button type="button" role="radio" class="tile" [class.on]="e === emoji()" [attr.aria-checked]="e === emoji()" [attr.aria-label]="'Vibe ' + e" (click)="emoji.set(e)">{{ e }}</button>
          }
        </div>
      </fieldset>

      <fieldset>
        <legend class="eyebrow">Your colour</legend>
        <div class="colors" role="radiogroup" aria-label="Colour">
          @for (c of colors; track c) {
            <button type="button" role="radio" class="dot" [style.background]="c" [class.on]="c === color()" [attr.aria-checked]="c === color()" [attr.aria-label]="'Colour ' + c" (click)="color.set(c)"></button>
          }
        </div>
      </fieldset>

      <button appButton size="lg" type="submit" [block]="true" [disabled]="!valid()" [loading]="busy()">{{ submitLabel() }}</button>
    </form>
  `,
  styles: `
    .who {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    .field {
      flex: 1;
      display: grid;
      gap: var(--space-2);
    }
    input {
      width: 100%;
      min-height: 3rem;
      padding: 0 var(--space-4);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      font-size: var(--text-lg);
      font-weight: 600;
    }
    fieldset {
      display: grid;
      gap: var(--space-3);
      padding: 0;
      margin: 0;
      border: 0;
      min-width: 0;
    }
    .emoji {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: var(--space-2);
    }
    .tile {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      min-height: var(--tap);
      font-size: 1.5rem;
      border-radius: var(--radius-md);
      background: var(--surface-2);
      border: 2px solid transparent;
      transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
    }
    .tile.on {
      border-color: var(--accent);
      transform: scale(1.05);
    }
    .colors {
      display: flex;
      gap: var(--space-3);
    }
    .dot {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      border: 3px solid transparent;
      box-shadow: 0 0 0 1px var(--border);
    }
    .dot.on {
      border-color: var(--surface);
      box-shadow: 0 0 0 2px var(--text);
    }
  `,
})
export class IdentityForm {
  readonly submitLabel = input('Continue');
  readonly busy = input(false);
  readonly done = output<void>();

  private readonly profile = inject(ProfileService);
  protected readonly emojis = VIBE_EMOJIS;
  protected readonly colors = PROFILE_COLORS;
  protected readonly maxName = MAX_NAME;

  protected readonly name = signal(this.profile.profile().name);
  protected readonly emoji = signal(this.profile.profile().emoji);
  protected readonly color = signal(this.profile.profile().color);
  protected readonly valid = computed(() => this.name().trim().length > 0);

  protected submit(event: Event): void {
    event.preventDefault();
    if (!this.valid()) return;
    this.profile.update({ name: this.name().trim(), emoji: this.emoji(), color: this.color() });
    this.done.emit();
  }
}
