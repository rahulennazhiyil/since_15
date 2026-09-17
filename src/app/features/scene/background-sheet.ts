import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { BACKGROUND_PACKS, BUILTIN_BACKGROUNDS, NO_BACKGROUND_ID, type BackgroundPack } from '../../core/scene/background-catalog';
import type { BackgroundFx } from '../../core/scene/scene.model';
import { Icon } from '../../shared/ui/icon';
import { Sheet } from '../../shared/ui/sheet';
import { Slider } from '../../shared/ui/slider';

export interface CustomBackgroundTile {
  id: string;
  url: string;
}

/** Bottom sheet: pick a built-in scene or your own photo, soften or dim it. */
@Component({
  selector: 'app-background-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sheet, Slider, Icon],
  template: `
    <app-sheet title="Background" [(open)]="open">
      <div class="grid" role="radiogroup" aria-label="Background">
        <button type="button" class="tile none" role="radio" [attr.aria-checked]="selectedId() === none" [class.selected]="selectedId() === none" (click)="pick(none)">
          <app-icon name="camera" [size]="22" />
          <span>My room</span>
        </button>
        @if (allowUpload()) {
          <button type="button" class="tile add" (click)="file.click()">
            <app-icon name="plus" [size]="22" />
            <span>Your photo</span>
          </button>
          <input #file type="file" accept="image/*" hidden (change)="onFile($event)" />
        }
        @for (c of custom(); track c.id) {
          <button type="button" class="tile" role="radio" [attr.aria-checked]="selectedId() === c.id" [class.selected]="selectedId() === c.id" (click)="pick(c.id)">
            <img [src]="c.url" alt="" />
            <span>Your photo</span>
          </button>
        }
      </div>
      @for (pack of packs; track pack.id) {
        <h3 class="pack">{{ pack.name }}</h3>
        <div class="grid" role="radiogroup" [attr.aria-label]="pack.name">
          @for (b of pack.items; track b.id) {
            <button type="button" class="tile" role="radio" [attr.aria-checked]="selectedId() === b.id" [class.selected]="selectedId() === b.id" (click)="pick(b.id)">
              <img [src]="b.thumb" [alt]="b.name" loading="lazy" />
              <span>{{ b.name }}</span>
            </button>
          }
        </div>
      }
      @if (selectedId() !== none) {
        <div class="fx">
          <app-slider label="Soften" [min]="0" [max]="100" [step]="5" [value]="blurPct()" [format]="pct" (valueChange)="onBlur($event)" />
          <app-slider label="Dim" [min]="0" [max]="100" [step]="5" [value]="dimPct()" [format]="pct" (valueChange)="onDim($event)" />
        </div>
      }
    </app-sheet>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
    }
    .pack {
      margin: var(--space-5) 0 var(--space-2);
      font-size: var(--text-sm);
      color: var(--text-muted);
      font-weight: 600;
    }
    .tile {
      position: relative;
      display: grid;
      align-content: end;
      aspect-ratio: 4 / 5;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--surface-2);
      border: 2px solid transparent;
      color: var(--text);
      font-size: var(--text-xs);
      font-weight: 600;
      text-align: left;
    }
    .tile img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .tile span {
      position: relative;
      padding: var(--space-2);
      background: linear-gradient(transparent, rgb(0 0 0 / 0.55));
      color: #fff;
    }
    .tile.none,
    .tile.add {
      place-items: center;
      align-content: center;
      gap: var(--space-1);
    }
    .tile.none span,
    .tile.add span {
      background: none;
      color: var(--text);
      padding: 0;
    }
    .tile.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 0.35);
    }
    .fx {
      display: grid;
      gap: var(--space-3);
      margin-top: var(--space-5);
    }
  `,
})
export class BackgroundSheet {
  readonly open = model(false);
  readonly selectedId = input.required<string>();
  readonly fx = input.required<BackgroundFx>();
  readonly allowUpload = input(false);
  readonly custom = input<readonly CustomBackgroundTile[]>([]);

  readonly backgroundChange = output<string>();
  readonly fxChange = output<BackgroundFx>();
  readonly upload = output<File>();

  protected readonly none = NO_BACKGROUND_ID;
  protected readonly packs = (Object.keys(BACKGROUND_PACKS) as BackgroundPack[]).map((id) => ({
    id,
    name: BACKGROUND_PACKS[id],
    items: BUILTIN_BACKGROUNDS.filter((b) => b.pack === id),
  }));
  protected readonly blurPct = computed(() => Math.round(this.fx().blur * 100));
  protected readonly dimPct = computed(() => Math.round(this.fx().dim * 100));
  protected readonly pct = (v: number): string => `${v}%`;

  protected pick(id: string): void {
    this.backgroundChange.emit(id);
  }

  protected onBlur(value: number): void {
    this.fxChange.emit({ ...this.fx(), blur: value / 100 });
  }

  protected onDim(value: number): void {
    this.fxChange.emit({ ...this.fx(), dim: value / 100 });
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload.emit(file);
    input.value = '';
  }
}
