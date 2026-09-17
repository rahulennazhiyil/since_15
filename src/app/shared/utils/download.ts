import { detectBrowserSupport } from '../../core/permissions/browser-support';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function canShareFiles(): boolean {
  return detectBrowserSupport().shareFiles;
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

export async function shareBlob(blob: Blob, filename: string, text: string): Promise<ShareOutcome> {
  if (!canShareFiles()) return 'unsupported';
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: 'since060815', text });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
