import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import type { Overlay } from '../../core/filters/filter.model';

export interface OverlayMove {
  id: string;
  /** Fractions of the preview width / height. */
  dx: number;
  dy: number;
}

const KEY_NUDGE = 0.01;

/**
 * Invisible drag handles laid over the preview, one per overlay. The overlays
 * themselves are drawn by the preview; this layer only handles selection and movement.
 */
@Component({
  selector: 'app-overlay-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onBackgroundClick($event)' },
  template: `
    @for (o of overlays(); track o.id) {
      <button
        type="button"
        class="hit"
        [class.selected]="o.id === selectedId()"
        [style.left.%]="o.x * 100"
        [style.top.%]="o.y * 100"
        [style.--s]="o.scale"
        [attr.aria-label]="label(o)"
        [attr.aria-pressed]="o.id === selectedId()"
        (pointerdown)="onPointerDown($event, o.id)"
        (pointermove)="onPointerMove($event, o.id)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (keydown)="onKeydown($event, o.id)"
        (click)="$event.stopPropagation(); select.emit(o.id)"
      ></button>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      container-type: size;
      touch-action: none;
    }
    .hit {
      position: absolute;
      width: max(2.75rem, calc(var(--s) * 100cqmin * 1.3));
      height: max(2.75rem, calc(var(--s) * 100cqmin * 1.3));
      transform: translate(-50%, -50%);
      border-radius: var(--radius-md);
      border: 2px dashed transparent;
      cursor: grab;
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    .hit:hover {
      border-color: rgb(255 255 255 / 0.5);
    }
    .hit.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.4);
    }
    .hit:active {
      cursor: grabbing;
    }
  `,
})
export class OverlayCanvas {
  readonly overlays = input.required<Overlay[]>();
  readonly selectedId = input<string | null>(null);

  readonly select = output<string | null>();
  readonly move = output<OverlayMove>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private dragging: { id: string; pointerId: number; lastX: number; lastY: number } | null = null;

  protected label(o: Overlay): string {
    return `${o.kind === 'shape' ? o.content : o.kind === 'text' ? `text "${o.content}"` : o.content}. Drag to move.`;
  }

  protected onPointerDown(event: PointerEvent, id: string): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    this.dragging = { id, pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    this.select.emit(id);
  }

  protected onPointerMove(event: PointerEvent, id: string): void {
    const d = this.dragging;
    if (!d || d.id !== id || d.pointerId !== event.pointerId) return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = (event.clientX - d.lastX) / rect.width;
    const dy = (event.clientY - d.lastY) / rect.height;
    d.lastX = event.clientX;
    d.lastY = event.clientY;
    if (dx !== 0 || dy !== 0) this.move.emit({ id, dx, dy });
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.dragging?.pointerId === event.pointerId) this.dragging = null;
  }

  protected onKeydown(event: KeyboardEvent, id: string): void {
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_NUDGE, 0],
      ArrowRight: [KEY_NUDGE, 0],
      ArrowUp: [0, -KEY_NUDGE],
      ArrowDown: [0, KEY_NUDGE],
    };
    const delta = map[event.key];
    if (!delta) return;
    event.preventDefault();
    this.move.emit({ id, dx: delta[0], dy: delta[1] });
  }

  protected onBackgroundClick(event: MouseEvent): void {
    if (event.target === this.host.nativeElement) this.select.emit(null);
  }
}
