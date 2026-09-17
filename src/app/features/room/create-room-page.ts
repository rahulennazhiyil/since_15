import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toAppError } from '../../core/errors/app-error';
import { RoomService } from '../../core/room/room.service';
import { PageShell } from '../../shared/layout/page-shell';
import { ToastService } from '../../shared/ui/toast.service';
import { IdentityForm } from '../profile/identity-form';

@Component({
  selector: 'app-create-room-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, IdentityForm, RouterLink],
  template: `
    <app-page-shell [narrow]="true">
      <div class="card box motion-rise">
        <p class="eyebrow">Start a room</p>
        <h1 class="title-lg">Who's in the picture?</h1>
        <p class="muted">Your person will see this name and vibe when they join. You'll get a link to send them next.</p>
        <app-identity-form submitLabel="Start the room" [busy]="busy()" (done)="start()" />
        <p class="small muted center">Already have a code? <a routerLink="/room/join">Join a room</a></p>
      </div>
    </app-page-shell>
  `,
  styles: `
    .box {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-8) var(--space-6);
      margin-top: var(--space-4);
    }
    .title-lg {
      margin-bottom: var(--space-1);
    }
    a {
      color: var(--accent-strong);
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
    app-identity-form {
      margin-top: var(--space-2);
    }
  `,
})
export class CreateRoomPage {
  private readonly room = inject(RoomService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  protected async start(): Promise<void> {
    this.busy.set(true);
    try {
      const code = await this.room.create();
      await this.router.navigate(['/room', code]);
    } catch (error) {
      this.toast.error(toAppError(error, 'connection-failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
