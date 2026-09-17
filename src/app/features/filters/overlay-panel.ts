import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { FilterDraft } from '../../core/filters/filter-draft';
import type { OverlayShape } from '../../core/filters/filter.model';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Slider } from '../../shared/ui/slider';

const EMOJI: readonly string[] = ['❤️', '✨', '🌙', '🌸', '⭐', '💫', '🥰', '😊', '🎀', '🌈', '💌', '🫶'];
const SHAPES: readonly { id: OverlayShape; label: string }[] = [
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
  { id: 'circle', label: 'Circle' },
];
const COLORS: readonly string[] = ['#ffffff', '#2b2622', '#e88aa0', '#b79ce8', '#ffd479', '#8fd6b4'];
const MAX_TEXT = 40;

/** Add emoji, text or shapes, then tune the selected item. Positioning happens on the preview. */
@Component({
  selector: 'app-overlay-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, IconButton, Slider],
  template: `
    <section>
      <p class="eyebrow">Add</p>
      <div class="emoji" role="group" aria-label="Emoji stickers">
        @for (e of emoji; track e) {
          <button type="button" class="tile" [attr.aria-label]="'Add ' + e" [disabled]="!draft().canAddOverlay()" (click)="draft().addOverlay('emoji', e)">{{ e }}</button>
        }
      </div>
      <div class="row">
        @for (s of shapes; track s.id) {
          <button appButton variant="secondary" size="sm" [disabled]="!draft().canAddOverlay()" (click)="draft().addOverlay('shape', s.id)">
            <app-icon name="shapes" [size]="16" /> {{ s.label }}
          </button>
        }
      </div>
      <form class="row text" (submit)="addText($event)">
        <input
          type="text"
          placeholder="Write something…"
          [value]="text()"
          [attr.maxlength]="maxText"
          aria-label="Text to add"
          (input)="text.set($any($event.target).value)"
        />
        <button appButton size="sm" type="submit" [disabled]="!text().trim() || !draft().canAddOverlay()">
          <app-icon name="type" [size]="16" /> Add
        </button>
      </form>
    </section>

    <section class="selected">
      @if (draft().selectedOverlay(); as o) {
        <div class="head">
          <p class="eyebrow">Selected</p>
          <button appIconButton icon="trash" label="Remove this item" (click)="draft().removeOverlay(o.id)"></button>
        </div>
        <app-slider label="Size" [min]="0.02" [max]="0.6" [step]="0.005" [value]="o.scale" [format]="percent" (valueChange)="draft().updateOverlay(o.id, { scale: $event })" />
        <app-slider label="Rotation" [min]="0" [max]="359" [step]="1" [value]="o.rotation" [format]="degrees" (valueChange)="draft().updateOverlay(o.id, { rotation: $event })" />
        <app-slider label="Opacity" [min]="0" [max]="1" [step]="0.01" [value]="o.opacity" [format]="percent" (valueChange)="draft().updateOverlay(o.id, { opacity: $event })" />
        @if (o.kind !== 'emoji') {
          <div class="colors" role="group" aria-label="Colour">
            @for (c of colors; track c) {
              <button type="button" class="swatch" [style.background]="c" [class.on]="o.color === c" [attr.aria-label]="'Colour ' + c" [attr.aria-pressed]="o.color === c" (click)="draft().updateOverlay(o.id, { color: c })"></button>
            }
          </div>
        }
        @if (o.kind === 'text') {
          <div class="row">
            <button appButton size="sm" [variant]="o.font === 'display' ? 'primary' : 'secondary'" (click)="draft().updateOverlay(o.id, { font: 'display' })">Serif</button>
            <button appButton size="sm" [variant]="o.font === 'ui' ? 'primary' : 'secondary'" (click)="draft().updateOverlay(o.id, { font: 'ui' })">Sans</button>
          </div>
        }
      } @else {
        <p class="hint">Tap an item on the preview to move or edit it. Drag to position.</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-5);
    }
    section {
      display: grid;
      gap: var(--space-3);
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
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .tile:hover {
      transform: scale(1.06);
    }
    .tile:disabled {
      opacity: 0.4;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .text input {
      flex: 1;
      min-width: 0;
      min-height: var(--tap);
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .colors {
      display: flex;
      gap: var(--space-2);
    }
    .swatch {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      border: 2px solid var(--border);
    }
    .swatch.on {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--surface);
    }
    .hint {
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
  `,
})
export class OverlayPanel {
  readonly draft = input.required<FilterDraft>();

  protected readonly emoji = EMOJI;
  protected readonly shapes = SHAPES;
  protected readonly colors = COLORS;
  protected readonly maxText = MAX_TEXT;
  protected readonly text = signal('');
  protected readonly percent = (v: number) => `${Math.round(v * 100)}`;
  protected readonly degrees = (v: number) => `${Math.round(v)}°`;

  protected addText(event: Event): void {
    event.preventDefault();
    const value = this.text().trim();
    if (!value) return;
    this.draft().addOverlay('text', value);
    this.text.set('');
  }
}
