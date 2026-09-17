import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ProfileService } from './core/profile/profile.service';
import { LiveRegion } from './shared/a11y/live-region';
import { BottomBar } from './shared/layout/bottom-bar';
import { Header } from './shared/layout/header';
import { Toasts } from './shared/ui/toasts';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, BottomBar, Toasts, LiveRegion],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);

  /** Immersive routes (camera, room) take the full screen without chrome. */
  protected readonly immersive = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => deepest(this.router.routerState.snapshot.root).data['immersive'] === true),
    ),
    { initialValue: false },
  );

  constructor() {
    // Instantiating the profile applies the persisted theme to the document.
    inject(ProfileService);
  }
}

function deepest(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? deepest(route.firstChild) : route;
}
