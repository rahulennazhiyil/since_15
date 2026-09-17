import { effect, inject, untracked, type Signal } from '@angular/core';
import type { BoothPhoto } from '../../core/booth/booth-session';
import { toAppError } from '../../core/errors/app-error';
import { ProfileService } from '../../core/profile/profile.service';
import { PhotoStore } from '../../core/storage/photo-store';
import type { PhotoQuality } from '../../core/storage/db';
import { ToastService } from '../../shared/ui/toast.service';

export interface AutoSaveContext {
  sessionId: string;
  roomCode: string | null;
  filterId: string;
  participants: string[];
  quality: PhotoQuality;
}

/**
 * Keeps the local library in step with a booth session's current photo: each new
 * composition is saved (or, for a re-filtered photo with the same id, replaced) while
 * the "save photos" preference is on. Call inside an injection context.
 */
export function setUpAutoSave(photo: Signal<BoothPhoto | null>, context: () => AutoSaveContext): void {
  const store = inject(PhotoStore);
  const profile = inject(ProfileService);
  const toast = inject(ToastService);
  let lastBlob: Blob | null = null;
  let warnedAboutSpace = false;

  effect(() => {
    const current = photo();
    if (!current || !profile.profile().autoSavePhotos) return;
    if (current.blob === lastBlob) return;
    lastBlob = current.blob;
    untracked(() => {
      const ctx = context();
      void store
        .save({
          id: current.id,
          blob: current.blob,
          width: current.width,
          height: current.height,
          createdAt: current.createdAt,
          layoutId: current.layoutId,
          ...ctx,
        })
        .then(async () => {
          if (!warnedAboutSpace && (await store.isNearlyFull())) {
            warnedAboutSpace = true;
            toast.show('Your browser storage is getting full. Download and delete a few photos to make room.', { durationMs: 8000 });
          }
        })
        .catch((error) => toast.error(toAppError(error, 'storage-failed')));
    });
  });
}
