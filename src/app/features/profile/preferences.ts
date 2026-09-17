import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../core/profile/profile.service';
import { InstallPromptService } from '../../core/pwa/install-prompt.service';
import { PhotoStore } from '../../core/storage/photo-store';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Switch } from '../../shared/ui/switch';

/** The few switches worth having; everything else is a sensible default. */
@Component({
  selector: 'app-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Switch, RouterLink, Button, Icon],
  template: `
    <app-switch
      label="Save photos to Memories"
      hint="Kept in this browser only. Nothing is uploaded."
      [checked]="profile.profile().autoSavePhotos"
      (checkedChange)="profile.update({ autoSavePhotos: $event })"
    />
    <app-switch
      label="Booth sounds"
      hint="Countdown ticks and the shutter"
      [checked]="profile.soundEnabled()"
      (checkedChange)="profile.update({ soundEnabled: $event })"
    />
    @if (installer.available()) {
      <div class="install">
        <div>
          <span class="label">Add to your home screen</span>
          <span class="hint">Opens like an app, still nothing uploaded.</span>
        </div>
        <button appButton size="sm" variant="secondary" (click)="installer.install()"><app-icon name="download" [size]="16" /> Install</button>
      </div>
    }
    <p class="small muted">
      {{ store.count() }} photo{{ store.count() === 1 ? '' : 's' }} in Memories ·
      <a routerLink="/privacy">Privacy &amp; clearing data</a>
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
    }
    .install {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: var(--tap);
    }
    .install > div {
      display: grid;
      line-height: 1.3;
    }
    .label {
      font-size: var(--text-sm);
      font-weight: 600;
    }
    .hint {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
    p {
      margin-top: var(--space-2);
    }
    a {
      color: var(--accent-strong);
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  `,
})
export class Preferences {
  protected readonly profile = inject(ProfileService);
  protected readonly store = inject(PhotoStore);
  protected readonly installer = inject(InstallPromptService);

  constructor() {
    void this.store.load();
  }
}
