import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  viewChild,
} from '@angular/core';
import { IconButton } from './icon-button';

/**
 * Modal surface built on the native <dialog>, which supplies focus containment,
 * Escape handling and an inert background. Renders as a bottom sheet on phones and a
 * centred card on wider screens.
 */
@Component({
  selector: 'app-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButton],
  template: `
    <dialog #dlg (close)="open.set(false)" (click)="onBackdropClick($event)" [attr.aria-label]="title()">
      <div class="panel">
        <header>
          <h2 class="title">{{ title() }}</h2>
          <button appIconButton icon="close" label="Close" (click)="open.set(false)"></button>
        </header>
        <div class="body">
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      position: fixed;
      inset: 0;
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      margin: 0;
      display: none;
      align-items: flex-end;
      justify-content: center;
      background: transparent;
    }
    dialog[open] {
      display: flex;
    }
    .panel {
      width: 100%;
      max-height: calc(100dvh - 3rem);
      overflow: auto;
      background: var(--surface);
      color: var(--text);
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      box-shadow: var(--shadow-lg);
      padding-bottom: var(--safe-bottom);
      animation: sheet-up var(--dur-slow) var(--ease-out);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-4) var(--space-2) var(--space-6);
    }
    .body {
      padding: var(--space-2) var(--space-6) var(--space-6);
    }
    @media (min-width: 640px) {
      dialog {
        align-items: center;
      }
      .panel {
        width: min(32rem, calc(100% - 2rem));
        border-radius: var(--radius-xl);
        animation-name: scale-in;
        padding-bottom: 0;
      }
    }
  `,
})
export class Sheet {
  readonly title = input.required<string>();
  readonly open = model(false);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (!el) return;
      if (this.open() && !el.open) el.showModal();
      else if (!this.open() && el.open) el.close();
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.open.set(false);
  }
}
