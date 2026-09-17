import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, Button, RouterLink],
  template: `
    <app-page-shell [narrow]="true">
      <div class="stack center motion-rise" style="--stack-gap: var(--space-4); padding-block: var(--space-12)">
        <p class="display" aria-hidden="true">·</p>
        <h1 class="title-lg">This page wandered off</h1>
        <p class="lead">The link may be old, or the room it pointed to has ended.</p>
        <div class="cluster" style="justify-content: center">
          <a appButton routerLink="/room/new">Start a Room</a>
          <a appButton variant="ghost" routerLink="/">Back home</a>
        </div>
      </div>
    </app-page-shell>
  `,
})
export class NotFound {}
