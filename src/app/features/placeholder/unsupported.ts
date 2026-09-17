import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ERROR_COPY } from '../../core/errors/error-copy';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';

type Reason = 'insecure-context' | 'browser-unsupported';

/** Shown by the camera guard when the browser cannot run the booth. */
@Component({
  selector: 'app-unsupported',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, Button, RouterLink],
  template: `
    <app-page-shell [narrow]="true">
      <div class="stack center motion-rise" style="--stack-gap: var(--space-4); padding-block: var(--space-12)">
        <h1 class="title-lg">{{ copy().title }}</h1>
        <p class="lead">{{ copy().message }}</p>
        <div><a appButton variant="secondary" routerLink="/">Back home</a></div>
      </div>
    </app-page-shell>
  `,
})
export class Unsupported {
  /** Bound from the `reason` query parameter. */
  readonly reason = input<string>();

  protected readonly copy = computed(() => {
    const r = this.reason();
    const key: Reason = r === 'insecure-context' ? 'insecure-context' : 'browser-unsupported';
    return ERROR_COPY[key];
  });
}
