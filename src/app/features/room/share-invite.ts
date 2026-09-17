import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { roomLink } from '../../core/room/room-code';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';

/** Room code, copy-link and share. Used on the waiting screen and in the header sheet. */
@Component({
  selector: 'app-share-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon],
  template: `
    <button type="button" class="code" (click)="copy()" aria-label="Room code, tap to copy the invite link">
      @for (ch of chars(); track $index) {
        <span>{{ ch }}</span>
      }
    </button>
    <div class="actions">
      <button appButton (click)="copy()"><app-icon name="copy" [size]="18" /> Copy invite link</button>
      @if (canShare) {
        <button appButton variant="secondary" (click)="share()"><app-icon name="share" [size]="18" /> Share</button>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: var(--space-5);
    }
    .code {
      display: flex;
      gap: 6px;
    }
    .code span {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 3rem;
      border-radius: var(--radius-md);
      background: rgb(255 255 255 / 0.1);
      border: 1px solid rgb(255 255 255 / 0.14);
      color: #fff;
      font-weight: 800;
      font-size: var(--text-xl);
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
    }
  `,
})
export class ShareInvite {
  readonly code = input.required<string>();

  private readonly toast = inject(ToastService);
  protected readonly chars = computed(() => [...this.code()]);
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  protected async copy(): Promise<void> {
    const link = roomLink(this.code());
    try {
      await navigator.clipboard.writeText(link);
      this.toast.success('Invite link copied');
    } catch {
      this.toast.show(`Your invite link: ${link}`, { durationMs: 0 });
    }
  }

  protected async share(): Promise<void> {
    try {
      await navigator.share({ title: 'Join my photo booth', text: 'Come take a photo with me ❤️', url: roomLink(this.code()) });
    } catch {
      // Cancelled or unsupported: nothing to report.
    }
  }
}
