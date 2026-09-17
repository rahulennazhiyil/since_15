import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type { PersonRole, SceneState } from '../../core/scene/scene.model';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Segmented } from '../../shared/ui/segmented';
import { Sheet } from '../../shared/ui/sheet';
import { Switch } from '../../shared/ui/switch';

/** Bottom sheet for placing the two people: auto-arrange, swap, layering, flips, reset. */
@Component({
  selector: 'app-arrange-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Sheet, Button, Icon, Segmented, Switch],
  template: `
    <app-sheet title="Arrange" [(open)]="open">
      <p class="hint">Drag anyone on the scene to move them, pinch or scroll to resize.</p>
      <div class="row">
        <button appButton variant="secondary" (click)="arrange.emit()"><app-icon name="wand" [size]="18" /> Auto arrange</button>
        <button appButton variant="secondary" (click)="swap.emit()"><app-icon name="swap" [size]="18" /> Swap sides</button>
      </div>
      <app-segmented label="Who is in front" [options]="frontOptions()" [value]="scene().front" (valueChange)="frontChange.emit($event)" />
      <div class="switches">
        <app-switch [label]="'Flip ' + selfName()" [checked]="flipOf(selfRole())" (checkedChange)="flipChange.emit({ role: selfRole(), flip: $event })" />
        <app-switch [label]="'Flip ' + partnerName()" [checked]="flipOf(partnerRole())" (checkedChange)="flipChange.emit({ role: partnerRole(), flip: $event })" />
      </div>
      <button appButton variant="ghost" size="sm" (click)="reset.emit()">Reset positions</button>
    </app-sheet>
  `,
  styles: `
    .hint {
      margin: 0 0 var(--space-4);
      color: var(--text-muted);
      font-size: var(--text-sm);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    .switches {
      display: grid;
      gap: var(--space-3);
      margin: var(--space-5) 0;
    }
  `,
})
export class ArrangeSheet {
  readonly open = model(false);
  readonly scene = input.required<SceneState>();
  readonly selfRole = input.required<PersonRole>();
  readonly selfName = input('You');
  readonly partnerName = input('Your person');

  readonly arrange = output<void>();
  readonly swap = output<void>();
  readonly reset = output<void>();
  readonly frontChange = output<PersonRole>();
  readonly flipChange = output<{ role: PersonRole; flip: boolean }>();

  protected readonly partnerRole = computed<PersonRole>(() => (this.selfRole() === 'host' ? 'guest' : 'host'));
  protected readonly frontOptions = computed(() => [
    { value: this.selfRole(), label: this.selfName() },
    { value: this.partnerRole(), label: this.partnerName() },
  ]);

  protected flipOf(role: PersonRole): boolean {
    return this.scene().people[role]?.flip ?? false;
  }
}
