import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Announcer } from './announcer.service';

@Component({
  selector: 'app-live-region',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcer.polite() }}</div>
    <div class="visually-hidden" aria-live="assertive" aria-atomic="true">{{ announcer.assertive() }}</div>
  `,
})
export class LiveRegion {
  protected readonly announcer = inject(Announcer);
}
