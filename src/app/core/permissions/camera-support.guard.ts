import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { detectBrowserSupport } from './browser-support';

/** Sends browsers that cannot open a camera to a friendly explanation instead of a broken page. */
export const cameraSupportGuard: CanActivateFn = () => {
  const support = detectBrowserSupport();
  const router = inject(Router);

  if (!support.secureContext) {
    return router.createUrlTree(['/unsupported'], { queryParams: { reason: 'insecure-context' } });
  }
  if (!support.camera || !support.canvas) {
    return router.createUrlTree(['/unsupported'], { queryParams: { reason: 'browser-unsupported' } });
  }
  return true;
};
