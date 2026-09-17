import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../../shared/ui/button';
import { Icon } from '../../../shared/ui/icon';
import { uid } from '../../../shared/utils/id';
import { ActivityChannel, isAsk, type AskPayload } from '../activity-channel';
import { isStroke, type Stroke } from '../activity-logic';

type Payload = { kind: 'stroke'; stroke: Stroke } | { kind: 'strokes'; strokes: Stroke[] } | { kind: 'clear' } | AskPayload;

const isPayload = (v: unknown): v is Payload => {
  if (isAsk(v)) return true;
  const p = v as Exclude<Payload, AskPayload>;
  return (
    !!p &&
    (p.kind === 'clear' ||
      (p.kind === 'stroke' && isStroke(p.stroke)) ||
      (p.kind === 'strokes' && Array.isArray(p.strokes) && p.strokes.every(isStroke)))
  );
};

const COLORS = ['#2b2622', '#d98a9c', '#9d8ae6', '#7fb3a6', '#e0a86b', '#7ea3d9'];
const SIZES = [0.008, 0.016, 0.03];

/** One shared canvas. Strokes travel as normalised points, so any two screen sizes agree. */
@Component({
  selector: 'app-drawing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon],
  template: `
    <div class="tools">
      <div class="colors" role="radiogroup" aria-label="Colour">
        @for (c of colors; track c) {
          <button type="button" role="radio" class="swatch" [style.background]="c" [class.on]="c === color()" [attr.aria-checked]="c === color()" [attr.aria-label]="'Colour ' + c" (click)="color.set(c)"></button>
        }
      </div>
      <div class="sizes" role="radiogroup" aria-label="Pen size">
        @for (s of sizes; track s) {
          <button type="button" role="radio" class="size" [class.on]="s === size()" [attr.aria-checked]="s === size()" [attr.aria-label]="'Pen size ' + s" (click)="size.set(s)">
            <i [style.width.px]="4 + s * 500" [style.height.px]="4 + s * 500"></i>
          </button>
        }
      </div>
      <button appButton variant="ghost" size="sm" (click)="clear()"><app-icon name="trash" [size]="16" /> Clear</button>
    </div>
    <canvas
      #canvas
      aria-label="Shared drawing"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up($event)"
      (pointercancel)="up($event)"
      (pointerleave)="up($event)"
    ></canvas>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .colors,
    .sizes {
      display: flex;
      gap: var(--space-2);
    }
    .swatch {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      border: 2px solid transparent;
      box-shadow: 0 0 0 1px var(--border);
    }
    .swatch.on {
      border-color: var(--surface);
      box-shadow: 0 0 0 2px var(--text);
    }
    .size {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      background: var(--surface-2);
    }
    .size.on {
      background: var(--accent-soft);
    }
    .size i {
      border-radius: 50%;
      background: var(--text);
    }
    canvas {
      width: 100%;
      aspect-ratio: 4 / 3;
      border-radius: var(--radius-lg);
      background: #fbf7f2;
      touch-action: none;
      cursor: crosshair;
      border: 1px solid var(--border);
    }
  `,
})
export class Drawing {
  private readonly channel = inject(ActivityChannel);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly colors = COLORS;
  protected readonly sizes = SIZES;
  protected readonly color = signal(COLORS[1]);
  protected readonly size = signal(SIZES[1]);

  private strokes: Stroke[] = [];
  private current: Stroke | null = null;
  private observer: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.fit();
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.canvas().nativeElement);
    });
    this.channel
      .on('drawing', isPayload)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((p) => {
        if (isAsk(p)) {
          if (this.channel.isHost()) this.channel.send('drawing', { kind: 'strokes', strokes: this.strokes } satisfies Payload);
        } else if (p.kind === 'clear') {
          this.strokes = [];
          this.redraw();
        } else if (p.kind === 'strokes') {
          const known = new Set(this.strokes.map((s) => s.id));
          for (const s of p.strokes) if (!known.has(s.id)) this.strokes.push(s);
          this.redraw();
        } else {
          this.strokes.push(p.stroke);
          this.draw(p.stroke);
        }
      });
    this.channel.requestStateOnConnect('drawing');
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  protected down(event: PointerEvent): void {
    const el = this.canvas().nativeElement;
    el.setPointerCapture(event.pointerId);
    this.current = { id: uid('stroke'), color: this.color(), size: this.size(), points: [...this.point(event)] };
  }

  protected move(event: PointerEvent): void {
    if (!this.current) return;
    const [x, y] = this.point(event);
    const pts = this.current.points;
    const n = pts.length;
    if (Math.hypot(x - pts[n - 2], y - pts[n - 1]) < 0.002) return;
    pts.push(x, y);
    this.drawSegment(this.current, n - 2);
  }

  protected up(event: PointerEvent): void {
    const stroke = this.current;
    if (!stroke) return;
    this.current = null;
    if (stroke.points.length === 2) {
      stroke.points.push(stroke.points[0] + 0.0005, stroke.points[1] + 0.0005); // a dot
      this.draw(stroke);
    }
    this.strokes.push(stroke);
    this.channel.send('drawing', { kind: 'stroke', stroke } satisfies Payload);
    event.preventDefault();
  }

  protected clear(): void {
    this.strokes = [];
    this.redraw();
    this.channel.send('drawing', { kind: 'clear' } satisfies Payload);
  }

  private point(event: PointerEvent): [number, number] {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))];
  }

  private fit(): void {
    const el = this.canvas().nativeElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(el.clientWidth * dpr);
    const height = Math.round(el.clientHeight * dpr);
    if (width === 0 || (el.width === width && el.height === height)) return;
    el.width = width;
    el.height = height;
    this.redraw();
  }

  private redraw(): void {
    const el = this.canvas().nativeElement;
    el.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    for (const s of this.strokes) this.draw(s);
  }

  private draw(stroke: Stroke): void {
    for (let i = 0; i + 2 < stroke.points.length; i += 2) this.drawSegment(stroke, i);
  }

  private drawSegment(stroke: Stroke, from: number): void {
    const el = this.canvas().nativeElement;
    const ctx = el.getContext('2d');
    if (!ctx || from + 3 >= stroke.points.length + 0) return;
    const p = stroke.points;
    const w = el.width;
    const h = el.height;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1, stroke.size * Math.min(w, h));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p[from] * w, p[from + 1] * h);
    ctx.lineTo(p[from + 2] * w, p[from + 3] * h);
    ctx.stroke();
  }
}
