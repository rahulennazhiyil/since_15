import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { ToastService } from '../../shared/ui/toast.service';
import { toAppError } from './app-error';

/**
 * Last line of defence. Anything that escapes a component or service surfaces as a
 * friendly toast; the technical cause is logged only in development.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    const appError = toAppError(error);
    if (isDevMode()) {
      console.error('[since060815]', appError.cause ?? appError);
    }
    this.toast.error(appError);
  }
}
