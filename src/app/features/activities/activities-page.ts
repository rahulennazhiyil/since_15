import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';
import { ActivityHost } from './activity-host';

@Component({
  selector: 'app-activities-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, RouterLink, Button, ActivityHost],
  template: `
    <app-page-shell [narrow]="true">
      <header class="head motion-rise">
        <p class="eyebrow">Activities</p>
        <h1 class="title-lg">Little things to do together</h1>
        <p class="muted">
          Inside a room these are shared live: the same card, the same canvas, the same list. Here you can try the
          ones that also work on your own.
        </p>
        <div class="cluster">
          <a appButton routerLink="/room/new">Start a room</a>
        </div>
      </header>
      <div class="card host">
        <app-activity-host [soloOnly]="true" />
      </div>
    </app-page-shell>
  `,
  styles: `
    .head {
      display: grid;
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }
    .host {
      padding: var(--space-6);
    }
  `,
})
export class ActivitiesPage {}
