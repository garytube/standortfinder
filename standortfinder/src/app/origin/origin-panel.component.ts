import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { LatLng } from '../geo/distance';
import type { OriginMode } from '../geo/origin.model';
import { FinderStore } from '../finder/finder.store';
import {
  OriginSearchService,
  type PlaceSearchResult,
} from './origin-search.service';

@Component({
  selector: 'app-origin-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './origin-panel.component.html',
  styleUrl: './origin-panel.component.css',
})
export class OriginPanelComponent {
  protected readonly store = inject(FinderStore);
  protected readonly search = inject(OriginSearchService);
  protected readonly placeQuery = signal('');
  protected readonly transitReference = signal('');
  protected readonly transitType = signal('subway');
  protected readonly fileError = signal('');

  protected chooseMode(mode: Exclude<OriginMode, null>): void {
    this.store.setOriginMode(mode);
  }

  protected updateText(
    target: { set(value: string): void },
    event: Event,
  ): void {
    target.set((event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  protected findPlace(): void {
    const query = this.placeQuery().trim();
    if (!query) return;
    this.search.searchPlaces(query, this.store.selectedCity() ?? 'Deutschland');
  }

  protected usePlace(result: PlaceSearchResult): void {
    this.store.setOrigin({ type: 'point', label: result.label, point: result.point });
  }

  protected findTransit(): void {
    const reference = this.transitReference().trim();
    const bounds = this.store.cityBounds();
    if (!reference || !bounds) return;
    this.search.searchTransit(reference, this.transitType(), bounds);
  }

  protected useTransit(): void {
    const path = this.search.transitResource.value();
    if (path.length < 2) return;
    this.store.setOrigin({
      type: 'path',
      label: `ÖPNV-Linie ${this.transitReference().trim()}`,
      path,
    });
  }

  protected async loadRouteFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileError.set('');
    try {
      const text = await file.text();
      const path = file.name.toLowerCase().endsWith('.gpx')
        ? this.pathFromGpx(text)
        : this.pathFromGeoJson(text);
      if (path.length < 2) throw new Error('empty route');
      this.store.setOrigin({
        type: 'path',
        label: file.name.replace(/\.[^.]+$/, ''),
        path,
      });
    } catch {
      this.fileError.set('Die Streckendatei konnte nicht gelesen werden.');
    } finally {
      input.value = '';
    }
  }

  private pathFromGpx(text: string): readonly LatLng[] {
    const documentNode = new DOMParser().parseFromString(text, 'application/xml');
    return [...documentNode.querySelectorAll('trkpt, rtept')].flatMap((point) => {
      const lat = Number(point.getAttribute('lat'));
      const lng = Number(point.getAttribute('lon'));
      return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
    });
  }

  private pathFromGeoJson(text: string): readonly LatLng[] {
    const parsed = JSON.parse(text) as {
      type?: string;
      features?: readonly { geometry?: { type?: string; coordinates?: unknown } }[];
      geometry?: { type?: string; coordinates?: unknown };
      coordinates?: unknown;
    };
    const geometry =
      parsed.type === 'FeatureCollection'
        ? parsed.features?.[0]?.geometry
        : parsed.geometry ?? parsed;
    const coordinates = geometry?.coordinates;
    if (!Array.isArray(coordinates)) return [];
    const pairs = geometry?.type === 'MultiLineString' ? coordinates.flat() : coordinates;
    return pairs.flatMap((pair) =>
      Array.isArray(pair) &&
      typeof pair[0] === 'number' &&
      typeof pair[1] === 'number'
        ? [{ lat: pair[1], lng: pair[0] }]
        : [],
    );
  }
}
