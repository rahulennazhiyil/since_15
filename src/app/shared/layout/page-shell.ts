import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Centred content column with the standard gutter. `narrow` for reading pages. */
@Component({
  selector: 'app-page-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.narrow]': 'narrow()' },
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: var(--content-max);
      margin-inline: auto;
      padding: var(--space-8) var(--gutter) var(--space-16);
    }
    :host(.narrow) {
      max-width: calc(var(--content-narrow) + 2 * var(--gutter));
    }
  `,
})
export class PageShell {
  readonly narrow = input(false);
}
