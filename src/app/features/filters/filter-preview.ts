import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FilterEngine } from '../../core/filters/filter-engine';
import type { FilterDefinition } from '../../core/filters/filter.model';
import { sampleFrame } from '../../core/filters/sample-frame';
import { CameraView } from '../booth/camera-view';

/**
 * Editor preview: the live camera when a stream is supplied, otherwise a generated
 * sample scene rendered through the real engine so every effect is visible.
 */
@Component({
  selector: 'app-filter-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CameraView],
  template: `
    @if (stream(); as s) {
      <app-camera-view [stream]="s" [mirrored]="mirrored()" [filter]="filter()" />
    } @else {
      <canvas #canvas aria-label="Filter preview on a sample scene"></canvas>
    }
    <ng-content />
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      background: #000;
    }
    app-camera-view,
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    canvas {
      object-fit: cover;
    }
  `,
})
export class FilterPreview {
  readonly filter = input.required<FilterDefinition>();
  readonly stream = input<MediaStream | null>(null);
  readonly mirrored = input(false);

  private readonly engine = inject(FilterEngine);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly sample = signal<ImageBitmap | null>(null);

  constructor() {
    void sampleFrame().then((bitmap) => this.sample.set(bitmap));

    afterRenderEffect(() => {
      const el = this.canvas()?.nativeElement;
      const source = this.sample();
      const filter = this.filter();
      if (!el || !source) return;
      if (el.width !== source.width) el.width = source.width;
      if (el.height !== source.height) el.height = source.height;
      this.engine.render(source, filter, el);
    });
  }
}
