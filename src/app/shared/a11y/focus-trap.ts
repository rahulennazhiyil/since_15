import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab focus inside the host while it is mounted and returns focus to the
 * previously focused element on destroy. For overlays that are not <dialog>s.
 */
@Directive({
  selector: '[appFocusTrap]',
  host: { '(keydown)': 'onKeydown($event)' },
})
export class FocusTrap {
  readonly autoFocus = input(true);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previouslyFocused: Element | null = document.activeElement;

  constructor() {
    afterNextRender(() => {
      if (this.autoFocus()) (this.focusables()[0] ?? this.host.nativeElement).focus();
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.previouslyFocused instanceof HTMLElement) this.previouslyFocused.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const items = this.focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
  }
}
