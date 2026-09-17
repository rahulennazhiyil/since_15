import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, RouterLink, Button],
  template: `
    <app-page-shell [narrow]="true">
      <article class="prose motion-rise">
        <p class="eyebrow">About</p>
        <h1 class="title-lg" style="margin-bottom: var(--space-4)">A photo booth for people miles apart.</h1>
        <p class="lead">
          since060815 is a small, free website for two people who cannot be in the same room right
          now. You open it, send one link, see each other, pick a filter, count down together and
          keep the photo.
        </p>

        <h2>Why it exists</h2>
        <p>
          Video calls are for talking. This is for the silly, sweet, in-between moments: a countdown,
          a flash, a picture of the two of you that neither of you could take alone.
        </p>

        <h2>What it costs</h2>
        <p>
          Nothing. There are no limits on filters, photos or camera time, and there are no ads inside
          the booth.
        </p>

        <h2>How it treats you</h2>
        <p>
          Everything stays on your device unless you choose to share it. Read the
          <a routerLink="/privacy">privacy page</a> for the full picture in plain words.
        </p>

        <div class="cluster" style="margin-top: var(--space-10)">
          <a appButton routerLink="/room/new">Start a Room</a>
          <a appButton variant="ghost" routerLink="/booth">Try the camera</a>
        </div>
      </article>
    </app-page-shell>
  `,
})
export class About {}
