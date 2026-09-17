import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Labelled on/off switch with proper switch semantics. */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="row">
      <span class="text">
        <span class="label">{{ label() }}</span>
        @if (hint()) {
          <span class="hint">{{ hint() }}</span>
        }
      </span>
      <button type="button" role="switch" class="switch" [attr.aria-checked]="checked()" (click)="checked.set(!checked())">
        <span class="knob"></span>
      </button>
    </label>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: var(--tap);
      cursor: pointer;
    }
    .text {
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
    .switch {
      position: relative;
      flex: none;
      width: 3rem;
      height: 1.75rem;
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      transition: background-color var(--dur-fast) var(--ease-out);
    }
    .switch[aria-checked='true'] {
      background: var(--accent);
    }
    .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: calc(1.75rem - 6px);
      height: calc(1.75rem - 6px);
      border-radius: 50%;
      background: #fff;
      box-shadow: var(--shadow-sm);
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .switch[aria-checked='true'] .knob {
      transform: translateX(1.25rem);
    }
  `,
})
export class Switch {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly checked = model.required<boolean>();
}
