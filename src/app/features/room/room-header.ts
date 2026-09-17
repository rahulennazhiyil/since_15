import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { roomLink } from '../../core/room/room-code';
import type { Participant, RoomStatus } from '../../core/room/room.model';
import { Avatar } from '../../shared/ui/avatar';
import { IconButton } from '../../shared/ui/icon-button';
import { ToastService } from '../../shared/ui/toast.service';
import { ConnectionIndicator } from './connection-indicator';

@Component({
  selector: 'app-room-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, IconButton, ConnectionIndicator],
  template: `
    <button appIconButton icon="chevron-left" label="Leave the room" variant="glass" (click)="leave.emit()"></button>
    <div class="middle">
      <button type="button" class="code" (click)="copy()" [attr.aria-label]="'Room ' + code() + '. Tap to copy the invite link.'">
        {{ code() }}
      </button>
      <app-connection-indicator [status]="status()" />
    </div>
    <div class="people" aria-label="People in the room">
      @for (p of participants(); track p.id) {
        <app-avatar [emoji]="p.emoji" [color]="p.color" [name]="p.name" size="sm" />
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: calc(var(--space-3) + var(--safe-top)) var(--gutter) var(--space-3);
    }
    .middle {
      display: grid;
      justify-items: center;
      gap: 2px;
    }
    .code {
      padding: 2px 10px;
      border-radius: var(--radius-pill);
      background: rgb(0 0 0 / 0.35);
      color: #fff;
      font-weight: 800;
      letter-spacing: 0.16em;
      font-size: var(--text-sm);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .people {
      display: flex;
      min-width: var(--tap);
      justify-content: flex-end;
    }
    .people app-avatar + app-avatar {
      margin-left: -8px;
    }
  `,
})
export class RoomHeader {
  readonly code = input.required<string>();
  readonly status = input.required<RoomStatus>();
  readonly participants = input.required<Participant[]>();
  readonly leave = output<void>();

  private readonly toast = inject(ToastService);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(roomLink(this.code()));
      this.toast.success('Invite link copied');
    } catch {
      this.toast.show(roomLink(this.code()), { durationMs: 0 });
    }
  }
}
