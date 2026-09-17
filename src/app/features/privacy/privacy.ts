import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toAppError } from '../../core/errors/app-error';
import { clearBoothDb } from '../../core/storage/db';
import { BackgroundStore } from '../../core/storage/background-store';
import { PhotoStore } from '../../core/storage/photo-store';
import { StorageService } from '../../core/storage/storage.service';
import { PageShell } from '../../shared/layout/page-shell';
import { Button } from '../../shared/ui/button';
import { Sheet } from '../../shared/ui/sheet';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, RouterLink, Button, Sheet],
  template: `
    <app-page-shell [narrow]="true">
      <article class="prose motion-rise">
        <p class="eyebrow">Privacy</p>
        <h1 class="title-lg" style="margin-bottom: var(--space-4)">Local first. Private by default.</h1>
        <p class="lead">
          Your camera stays in your browser unless you choose to share it with someone in a room.
          Here is exactly what happens, in plain language.
        </p>

        <h2>Your camera and microphone</h2>
        <p>
          We ask for camera access only when you open the booth or a room, and for the microphone only
          inside a room. You can say no and the site will tell you what still works. Nothing is
          recorded, and nothing from your camera is sent anywhere while you are on your own.
        </p>

        <h2>Inside a room</h2>
        <p>
          When your person joins, video and audio travel directly between your two browsers. It does
          not pass through our servers, and we never record it. A small helper service is used only
          to introduce the two browsers to each other. It sees your room code, the name and emoji you
          picked, and the technical details needed to open the connection. It does not see your video.
        </p>

        <h2>Your photos</h2>
        <p>
          Photos are composed on your device and saved in your browser's own storage. They are not
          uploaded. In a room, the photo you take together is sent directly to your person's browser
          so you both keep the same picture. You can download any photo to keep it somewhere safer,
          and delete any photo from Memories.
        </p>

        <h2>Rooms</h2>
        <p>
          A room exists only while someone is in it. When everyone leaves, it disappears. Room codes
          are random and not listed anywhere, so only people you send the link to can find yours.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>No accounts, passwords or email addresses.</li>
          <li>No analytics, advertising or tracking scripts.</li>
          <li>No third-party fonts or embeds that could watch you.</li>
          <li>No storage of photos, video or audio on any server.</li>
        </ul>

        <h2>Your preferences</h2>
        <p>
          Your display name, chosen emoji, theme and filters are kept in your browser so you do not
          have to set them again. That is all we store about you.
        </p>

        <h2>Clear everything</h2>
        <p>
          This removes every photo, custom filter, background photo and preference from this browser.
          Photos you have downloaded are not affected.
        </p>
        <p><button appButton variant="danger" (click)="confirm.set(true)">Clear my data</button></p>

        <p style="margin-top: var(--space-10)">
          <a routerLink="/about">About since060815</a>
        </p>
      </article>
    </app-page-shell>

    <app-sheet title="Clear everything on this device?" [(open)]="confirm">
      <p class="muted" style="margin-bottom: var(--space-5)">
        {{ photos.count() }} photo{{ photos.count() === 1 ? '' : 's' }}, your custom filters, background photos and
        preferences will be removed from this browser. This cannot be undone.
      </p>
      <div class="cluster" style="justify-content: flex-end">
        <button appButton variant="ghost" (click)="confirm.set(false)">Keep everything</button>
        <button appButton variant="danger" [loading]="clearing()" (click)="clearAll()">Clear my data</button>
      </div>
    </app-sheet>
  `,
})
export class Privacy {
  protected readonly photos = inject(PhotoStore);
  private readonly backgrounds = inject(BackgroundStore);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  protected readonly confirm = signal(false);
  protected readonly clearing = signal(false);

  constructor() {
    void this.photos.load();
  }

  protected async clearAll(): Promise<void> {
    this.clearing.set(true);
    try {
      await clearBoothDb();
      this.storage.clearAll();
      this.photos.resetAfterWipe();
      this.backgrounds.resetAfterWipe();
      this.toast.success('Everything on this device was cleared');
      // Reload so every in-memory preference (theme, name, filters) starts fresh.
      setTimeout(() => this.document.location.assign('/'), 600);
    } catch (error) {
      this.toast.error(toAppError(error, 'storage-failed'));
      this.clearing.set(false);
    }
  }
}
