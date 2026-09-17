import { Injectable, signal } from '@angular/core';
import type { AppError } from '../../core/errors/app-error';
import { uid } from '../utils/id';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
}

export interface ToastOptions {
  kind?: ToastKind;
  title?: string;
  /** 0 keeps the toast until dismissed. */
  durationMs?: number;
}

const DEFAULT_DURATION: Record<ToastKind, number> = { info: 3500, success: 3000, error: 6000 };
const MAX_VISIBLE = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly toasts = this.items.asReadonly();

  show(message: string, options: ToastOptions = {}): string {
    const kind = options.kind ?? 'info';
    const toast: Toast = { id: uid('toast'), kind, title: options.title, message };
    this.items.update((list) => [...list, toast].slice(-MAX_VISIBLE));

    const duration = options.durationMs ?? DEFAULT_DURATION[kind];
    if (duration > 0) {
      this.timers.set(toast.id, setTimeout(() => this.dismiss(toast.id), duration));
    }
    return toast.id;
  }

  success(message: string, title?: string): string {
    return this.show(message, { kind: 'success', title });
  }

  error(error: AppError): string {
    const copy = error.userMessage;
    return this.show(copy.message, { kind: 'error', title: copy.title });
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
