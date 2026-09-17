import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ERROR_COPY } from '../../core/errors/error-copy';
import { ROOM_CODE_LENGTH, extractRoomCode, normalizeRoomCode } from '../../core/room/room-code';
import { PageShell } from '../../shared/layout/page-shell';
import { IdentityForm } from '../profile/identity-form';

@Component({
  selector: 'app-join-room-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, IdentityForm, RouterLink],
  template: `
    <app-page-shell [narrow]="true">
      <div class="card box motion-rise">
        <p class="eyebrow">Join a room</p>
        <h1 class="title-lg">Got a code?</h1>
        <label class="code-field">
          <span class="eyebrow">Room code or invite link</span>
          <input
            type="text"
            inputmode="text"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            placeholder="M7K2PQ"
            [value]="code()"
            (input)="onInput($any($event.target).value)"
            (paste)="onPaste($event)"
            [attr.aria-invalid]="showError() || null"
            aria-describedby="code-hint"
          />
          <span id="code-hint" class="small" [class.muted]="!showError()" [class.error]="showError()">
            {{ showError() ? invalidCopy : 'Six letters and numbers, or paste the link you were sent.' }}
          </span>
        </label>
        <app-identity-form submitLabel="Join the room" (done)="join()" />
        <p class="small muted center">Want your own? <a routerLink="/room/new">Start a room</a></p>
      </div>
    </app-page-shell>
  `,
  styles: `
    .box {
      display: grid;
      gap: var(--space-5);
      padding: var(--space-8) var(--space-6);
      margin-top: var(--space-4);
    }
    .code-field {
      display: grid;
      gap: var(--space-2);
    }
    .code-field input {
      width: 100%;
      min-height: 3.5rem;
      padding: 0 var(--space-4);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      font-size: var(--text-2xl);
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .code-field input[aria-invalid='true'] {
      border-color: var(--danger);
    }
    .error {
      color: var(--danger);
    }
    a {
      color: var(--accent-strong);
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  `,
})
export class JoinRoomPage {
  /** Optional ?code= from an invite that needed an identity first. */
  readonly code$ = input<string>('', { alias: 'code' });

  private readonly router = inject(Router);
  protected readonly code = signal('');
  protected readonly attempted = signal(false);
  protected readonly invalidCopy = ERROR_COPY['invalid-room-code'].message;

  protected readonly valid = computed(() => this.code().length === ROOM_CODE_LENGTH);
  protected readonly showError = computed(() => this.attempted() && !this.valid());

  constructor() {
    effect(() => {
      const initial = this.code$();
      if (initial) this.code.set(normalizeRoomCode(initial));
    });
  }

  protected onInput(value: string): void {
    // Links can arrive by typing or autofill as well as by paste.
    const fromLink = value.includes('/') ? extractRoomCode(value) : null;
    this.code.set(fromLink ?? normalizeRoomCode(value));
    this.attempted.set(false);
  }

  protected onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const extracted = extractRoomCode(text);
    if (extracted) {
      event.preventDefault();
      this.code.set(extracted);
    }
  }

  protected join(): void {
    this.attempted.set(true);
    if (!this.valid()) return;
    void this.router.navigate(['/room', this.code()]);
  }
}
