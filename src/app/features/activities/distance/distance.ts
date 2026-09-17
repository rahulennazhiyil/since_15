import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StorageService, type StorageKeyDef } from '../../../core/storage/storage.service';
import { Icon } from '../../../shared/ui/icon';
import { ActivityChannel, isAsk, type AskPayload } from '../activity-channel';
import { formatDistance, haversineKm } from '../activity-logic';
import { CITIES, type City } from '../content';

interface CityPayload {
  city: string;
}
type Payload = CityPayload | AskPayload;

const STORAGE: StorageKeyDef<string | null> = { key: 'distance-city', version: 1, defaults: () => null };
const isPayload = (v: unknown): v is Payload => isAsk(v) || typeof (v as CityPayload)?.city === 'string';

/** Two cities from a short list; no location permission, ever. */
@Component({
  selector: 'app-distance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="pair">
      <div class="side">
        <span class="eyebrow">You</span>
        <select aria-label="Your city" [value]="mine() ?? ''" (change)="pick($any($event.target).value)">
          <option value="" disabled>Choose a city</option>
          @for (c of cities; track c.name) {
            <option [value]="c.name">{{ c.name }}, {{ c.country }}</option>
          }
        </select>
      </div>
      <span class="heart" aria-hidden="true"><app-icon name="heart" [filled]="true" /></span>
      <div class="side">
        <span class="eyebrow">Them</span>
        <span class="city">{{ theirs() ?? (channel.connected() ? 'Waiting for their pick…' : 'They pick when they join') }}</span>
      </div>
    </div>
    <p class="result">{{ result() }}</p>
    <p class="small muted">Cities only, chosen by hand. We never ask for your location.</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-4);
      text-align: center;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: var(--space-3);
    }
    .side {
      display: grid;
      gap: var(--space-2);
      min-width: 0;
    }
    select {
      min-height: var(--tap);
      padding: 0 var(--space-3);
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      max-width: 100%;
    }
    .city {
      min-height: var(--tap);
      display: grid;
      place-items: center;
      font-weight: 700;
      padding: 0 var(--space-2);
    }
    .heart {
      color: var(--accent-strong);
      animation: pulse-soft 2.4s var(--ease-in-out) infinite;
    }
    .result {
      font-family: var(--font-display);
      font-style: italic;
      font-size: var(--text-2xl);
      color: var(--accent-strong);
    }
    @media (prefers-reduced-motion: reduce) {
      .heart {
        animation: none;
      }
    }
  `,
})
export class Distance {
  protected readonly channel = inject(ActivityChannel);
  private readonly storage = inject(StorageService);

  protected readonly cities = CITIES;
  protected readonly mine = signal<string | null>(this.storage.read(STORAGE));
  protected readonly theirs = signal<string | null>(null);

  protected readonly result = computed(() => {
    const a = this.find(this.mine());
    const b = this.find(this.theirs());
    if (!a || !b) return 'Pick your cities to see how far';
    return formatDistance(haversineKm(a.lat, a.lon, b.lat, b.lon));
  });

  constructor() {
    effect(() => this.storage.write(STORAGE, this.mine()));
    effect(() => {
      if (this.channel.connected()) untracked(() => this.share());
    });
    this.channel
      .on('distance', isPayload)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((p) => {
        if (isAsk(p)) {
          this.share();
          return;
        }
        if (!this.find(p.city)) return;
        const news = this.theirs() !== p.city;
        this.theirs.set(p.city);
        if (news) this.share();
      });
    this.channel.requestStateOnConnect('distance');
  }

  protected pick(city: string): void {
    this.mine.set(city || null);
    this.share();
  }

  private find(name: string | null): City | undefined {
    return name ? this.cities.find((c) => c.name === name) : undefined;
  }

  private share(): void {
    const city = this.mine();
    if (city) this.channel.send('distance', { city } satisfies CityPayload);
  }
}
