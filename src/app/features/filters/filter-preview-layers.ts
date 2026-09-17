import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { previewLayers } from '../../core/filters/filter-engine';
import type { FilterDefinition, Overlay } from '../../core/filters/filter.model';
import { DATE_STAMP_COLOR, formatDateStamp } from '../../core/filters/passes/date-stamp';

const SHAPE_PATHS: Record<string, string> = {
  heart: 'M16 26C7 20 2 15 2 9.5 2 5.4 5 2.5 8.7 2.5c2.9 0 5.3 1.7 7.3 4.3 2-2.6 4.4-4.3 7.3-4.3C27 2.5 30 5.4 30 9.5 30 15 25 20 16 26z',
  star: 'M16 2l4.1 8.9 9.7 1.1-7.2 6.6 2 9.6L16 23.4l-8.6 4.8 2-9.6L2.2 12l9.7-1.1z',
  circle: 'M16 2a14 14 0 1 0 0 28 14 14 0 0 0 0-28z',
};

/**
 * Everything a filter adds on top of the CSS `filter` on the video: blend layers,
 * overlays and the date stamp. Sizes use container query units so overlays match the
 * canvas render, where size is a fraction of the shorter edge.
 */
@Component({
  selector: 'app-filter-preview-layers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (layer of layers(); track $index) {
      <div
        class="layer"
        [style.background]="layer.background"
        [style.mix-blend-mode]="layer.blend"
        [style.opacity]="layer.opacity"
        [style.backdrop-filter]="layer.backdropFilter ?? null"
        [style.-webkit-backdrop-filter]="layer.backdropFilter ?? null"
      ></div>
    }
    @for (o of filter().overlays; track o.id) {
      <span
        class="ov"
        [class.display]="o.font === 'display'"
        [class.text]="o.kind === 'text'"
        [style.left.%]="o.x * 100"
        [style.top.%]="o.y * 100"
        [style.--s]="o.scale"
        [style.--r.deg]="o.rotation"
        [style.opacity]="o.opacity"
        [style.color]="o.color ?? null"
      >
        @if (o.kind === 'shape') {
          <svg viewBox="0 0 32 32"><path [attr.d]="shapePath(o)" fill="currentColor" /></svg>
        } @else {
          {{ o.content }}
        }
      </span>
    }
    @if (filter().effects.dateStamp) {
      <span class="stamp" [style.color]="stampColor">{{ stamp }}</span>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      container-type: size;
    }
    .layer {
      position: absolute;
      inset: 0;
    }
    .ov {
      position: absolute;
      transform: translate(-50%, -50%) rotate(var(--r, 0deg));
      font-size: calc(var(--s) * 100cqmin);
      line-height: 1;
      white-space: nowrap;
      font-family: var(--font-ui);
      font-weight: 700;
    }
    .ov.text {
      text-shadow: 0 0 0.15em rgb(0 0 0 / 0.25);
    }
    .ov.display {
      font-family: var(--font-display);
      font-style: italic;
      font-weight: 400;
    }
    .ov svg {
      width: calc(var(--s) * 100cqmin);
      height: calc(var(--s) * 100cqmin);
    }
    .stamp {
      position: absolute;
      right: 5cqmin;
      bottom: 5cqmin;
      font-size: 5.5cqmin;
      font-weight: 600;
      font-family: var(--font-ui);
      text-shadow: 0 0 0.35em rgb(255 140 40 / 0.75);
    }
  `,
})
export class FilterPreviewLayers {
  readonly filter = input.required<FilterDefinition>();

  protected readonly layers = computed(() => previewLayers(this.filter()));
  protected readonly stamp = formatDateStamp(new Date());
  protected readonly stampColor = DATE_STAMP_COLOR;

  protected shapePath(o: Overlay): string {
    return SHAPE_PATHS[o.content] ?? SHAPE_PATHS['circle'];
  }
}
