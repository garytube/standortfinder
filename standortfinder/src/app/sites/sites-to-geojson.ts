import type { SiteApiResponse } from './site-api.model';
import type { SiteFeature, SitesGeoJson } from './site-geojson.model';

function hasFiniteCoordinates(value: unknown): value is SiteApiResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const site = value as Partial<SiteApiResponse>;
  return Number.isFinite(site.longitude) && Number.isFinite(site.latitude);
}

export function sitesToGeoJson(raw: unknown): SitesGeoJson {
  if (!Array.isArray(raw)) {
    throw new Error('Standort-API liefert keine Liste');
  }

  return {
    type: 'FeatureCollection',
    features: raw.filter(hasFiniteCoordinates).map(
      (site): SiteFeature => ({
        type: 'Feature',
        id: site.sid,
        geometry: {
          type: 'Point',
          coordinates: [site.longitude, site.latitude],
        },
        properties: {
          sid: site.sid,
          siteDescription: site.siteDescription ?? '',
          city: site.city ?? 'Ohne Stadt',
          gkz: String(site.gkz ?? ''),
          plz: String(site.plz ?? ''),
          imageIDs: site.imageIDs ?? [],
          faces: site.faces ?? [],
        },
      }),
    ),
  };
}
