import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { FinderStore } from '../finder/finder.store';
import type { SiteFaceApiResponse } from '../sites/site-api.model';
import type { SiteFeature } from '../sites/site-geojson.model';

@Component({
  selector: 'app-result-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-selected]': 'store.isSiteSelected(site())',
  },
  template: `
    <button type="button" class="card-button" (click)="select()">
      <span class="thumb" aria-hidden="true">
        <span class="ad-shape"></span>
        @if (panelCount() > 1) {
          <span class="icon-badge">{{ panelCount() }}</span>
        }
      </span>
      <span class="card-main">
        <strong>{{ site().properties.siteDescription || 'Werbefläche' }}</strong>
        <span class="card-meta">
          {{ mediaLabel() }}
          @if (directionLabel()) { · Blick {{ directionLabel() }} }
        </span>
        <span class="card-foot">
          @if (priceLabel()) {
            <span class="price">{{ priceLabel() }} <em>pro Tag und Fläche</em></span>
          } @else {
            <span class="price"><em>Preis auf Anfrage</em></span>
          }
          <span class="site-id">Nr. {{ site().properties.sid }}</span>
        </span>
      </span>
    </button>
  `,
  styles: `
    :host { display: block; border: 1px solid transparent; margin-bottom: 2px; }
    :host(:hover) { background: var(--hover-bg); }
    :host.is-selected { border-color: var(--text); background: var(--blue-soft); }
    .card-button { display: flex; gap: 12px; width: 100%; padding: 11px; text-align: left; }
    .thumb { position: relative; width: 56px; height: 56px; flex: 0 0 56px; display: grid; place-content: center; background: var(--icon-bg); }
    .ad-shape { width: 25px; height: 34px; border: 2px solid var(--blue); border-bottom-width: 4px; }
    .icon-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px; display: grid; place-content: center; border: 2px solid var(--bg); border-radius: 10px; background: var(--ink); color: #fff; font-size: 10px; font-weight: 700; }
    .card-main { flex: 1; min-width: 0; }
    strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--t-sm); }
    .card-meta { display: block; margin-top: 2px; color: var(--ink-30); font-size: var(--t-xs); }
    .card-foot { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; }
    .price { font-size: var(--t-sm); font-weight: 700; }
    .price em { color: var(--ink-30); font-size: var(--t-xs); font-style: normal; font-weight: 400; }
    .site-id { margin-left: auto; color: var(--ink-30); font-size: var(--t-xs); }
  `,
})
export class ResultCardComponent {
  readonly site = input.required<SiteFeature>();
  protected readonly store = inject(FinderStore);

  protected readonly matchingFaces = computed<readonly SiteFaceApiResponse[]>(() => {
    const faces = this.site().properties.faces;
    const active = this.store.activeMedia();
    return active.size
      ? faces.filter((face) => active.has(face.media?.mediaName ?? 'Werbefläche'))
      : faces;
  });

  protected readonly panelCount = computed(() =>
    this.matchingFaces().reduce(
      (count, face) => count + (face.panelNumbers?.length || 1),
      0,
    ) || 1,
  );
  protected readonly mediaLabel = computed(() => {
    const names = this.matchingFaces().map(
      (face) => face.media?.mediaName ?? 'Werbefläche',
    );
    return [...new Set(names)].join(', ') || 'Werbefläche';
  });
  protected readonly directionLabel = computed(() => {
    const values = this.matchingFaces()
      .map((face) => face.direction)
      .filter((value) => value !== null && value !== undefined);
    return [...new Set(values)].join(', ');
  });
  protected readonly priceLabel = computed(() => {
    const prices = this.matchingFaces()
      .map((face) => face.price)
      .filter((price): price is number => typeof price === 'number');
    if (prices.length === 0) return '';
    const minimum = Math.min(...prices);
    const formatted = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(minimum);
    return new Set(prices).size > 1 ? `ab ${formatted}` : formatted;
  });

  protected select(): void {
    this.store.toggleSite(this.site());
    this.store.focusSite(this.site());
  }
}
