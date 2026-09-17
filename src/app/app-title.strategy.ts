import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const APP_NAME = 'since060815';
const DEFAULT_TITLE = `${APP_NAME} · A Photo Booth for People Miles Apart`;

/** "Privacy · since060815" on inner pages, the full tagline on the landing page. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · ${APP_NAME}` : DEFAULT_TITLE);
  }
}
