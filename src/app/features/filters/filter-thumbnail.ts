import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { FilterEngine } from '../../core/filters/filter-engine';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { coverCrop } from '../../core/photo/layouts';

/** A square canvas showing `filter` applied to `source`. Re-renders only when either changes. */
@Component({
  selector: 'app-filter-thumbnail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas [width]="size()" [height]="size()" aria-hidden="true"></canvas>`,
  styles: `
    :host {
      display: block;
      line-height: 0;
    }
    canvas {
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: var(--surface-2);
    }
  `,
})
export class FilterThumbnail {
  readonly source = input.required<ImageBitmap | null>();
  readonly filter = input.required<FilterDefinition>();
  readonly size = input(64);

  private readonly engine = inject(FilterEngine);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    // Runs after the view exists, so the very first render can draw as well.
    afterRenderEffect(() => {
      const source = this.source();
      const filter = this.filter();
      const el = this.canvas().nativeElement;
      const ctx = el.getContext('2d');
      if (!ctx) return;
      if (!source) {
        ctx.clearRect(0, 0, el.width, el.height);
        return;
      }
      const rendered = this.engine.render(source, filter);
      const crop = coverCrop(rendered.width, rendered.height, el.width, el.height);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.drawImage(rendered, crop.x, crop.y, crop.width, crop.height, 0, 0, el.width, el.height);
    });
  }
}
