import { httpResource } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { EMPTY_SITES_GEOJSON, type SitesGeoJson } from './site-geojson.model';
import { sitesToGeoJson } from './sites-to-geojson';

export const SITES_API_URL = 'https://standortfinder.wall.de/api/sites';

@Injectable({ providedIn: 'root' })
export class SitesService {
  readonly year = signal(2026);

  readonly resource = httpResource<SitesGeoJson>(
    () => ({
      url: SITES_API_URL,
      params: { year: this.year() },
      headers: { Accept: 'application/json' },
    }),
    {
      defaultValue: EMPTY_SITES_GEOJSON,
      parse: sitesToGeoJson,
      debugName: 'standortfinder-sites',
    },
  );

  readonly sites = this.resource.value;
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  reload(): boolean {
    return this.resource.reload();
  }
}
