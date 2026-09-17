import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, type Type, computed, inject, input, signal } from '@angular/core';
import { ActivityChannel } from './activity-channel';
import { ACTIVITIES, type ActivityDefinition } from './activity.model';
import { Icon } from '../../shared/ui/icon';
import { IconButton } from '../../shared/ui/icon-button';
import { Spinner } from '../../shared/ui/spinner';

/**
 * Picker plus lazy loader for one activity at a time. Lives inside a sheet in the room
 * (cameras stay visible above it) and on the /activities page for solo use.
 */
@Component({
  selector: 'app-activity-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, Icon, IconButton, Spinner],
  template: `
    @if (current(); as def) {
      <header class="head">
        <button appIconButton icon="chevron-left" label="All activities" (click)="close()"></button>
        <div class="titles">
          <strong>{{ def.name }}</strong>
          @if (!channel.connected() && !def.solo) {
            <span class="small muted">Works once your person is here</span>
          }
        </div>
      </header>
      @if (component(); as cmp) {
        <ng-container *ngComponentOutlet="cmp; inputs: def.inputs ?? {}" />
      } @else {
        <div class="loading"><app-spinner /></div>
      }
    } @else {
      <ul class="grid">
        @for (a of available(); track a.id) {
          <li>
            <button type="button" class="tile" (click)="open(a)">
              <span class="mark"><app-icon [name]="a.icon" /></span>
              <strong>{{ a.name }}</strong>
              <span class="small muted">{{ a.description }}</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }
    .titles {
      display: grid;
      line-height: 1.3;
    }
    .loading {
      display: grid;
      place-items: center;
      padding: var(--space-8);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);
    }
    .tile {
      display: grid;
      gap: 4px;
      width: 100%;
      min-height: 7rem;
      padding: var(--space-4);
      text-align: left;
      border-radius: var(--radius-lg);
      background: var(--surface-2);
      border: 1px solid transparent;
      transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
    }
    .tile:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
    }
    .mark {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--radius-md);
      background: var(--accent-soft);
      color: var(--accent-strong);
      margin-bottom: var(--space-1);
    }
    @media (min-width: 640px) {
      .grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `,
})
export class ActivityHost {
  /** Hide two-person activities when there is no room (the /activities page). */
  readonly soloOnly = input(false);

  protected readonly channel = inject(ActivityChannel);
  protected readonly current = signal<ActivityDefinition | null>(null);
  protected readonly component = signal<Type<unknown> | null>(null);
  protected readonly available = computed(() => (this.soloOnly() ? ACTIVITIES.filter((a) => a.solo) : ACTIVITIES));

  protected async open(def: ActivityDefinition): Promise<void> {
    this.current.set(def);
    this.component.set(null);
    const cmp = await def.load();
    if (this.current() === def) this.component.set(cmp);
  }

  protected close(): void {
    this.current.set(null);
    this.component.set(null);
  }
}
