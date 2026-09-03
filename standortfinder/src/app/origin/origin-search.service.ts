import { httpResource } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { distanceMeters, type LatLng } from '../geo/distance';
import type { CityBounds } from '../finder/finder.store';

export interface PlaceSearchResult {
  readonly label: string;
  readonly point: LatLng;
}

interface PlaceRequest {
  readonly query: string;
  readonly city: string;
}

interface TransitRequest {
  readonly reference: string;
  readonly routeType: string;
  readonly bounds: CityBounds;
}

function parsePlaces(raw: unknown): readonly PlaceSearchResult[] {
  if (!Array.isArray(raw)) throw new Error('Kartendienst liefert keine Trefferliste');
  return raw.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return [];
    const lat = Number(Reflect.get(value, 'lat'));
    const lng = Number(Reflect.get(value, 'lon'));
    const label = Reflect.get(value, 'display_name');
    return Number.isFinite(lat) && Number.isFinite(lng) && typeof label === 'string'
      ? [{ label, point: { lat, lng } }]
      : [];
  });
}

function parseTransitPath(raw: unknown): readonly LatLng[] {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('OpenStreetMap liefert keine Liniengeometrie');
  }
  const elements = Reflect.get(raw, 'elements');
  if (!Array.isArray(elements)) throw new Error('OpenStreetMap liefert keine Liniengeometrie');
  const segments = elements.flatMap((element) => {
    if (typeof element !== 'object' || element === null) return [];
    const geometry = Reflect.get(element, 'geometry');
    if (!Array.isArray(geometry)) return [];
    const points = geometry.flatMap((point) => {
      if (typeof point !== 'object' || point === null) return [];
      const lat = Reflect.get(point, 'lat');
      const lon = Reflect.get(point, 'lon');
      return typeof lat === 'number' && typeof lon === 'number'
        ? [{ lat, lng: lon }]
        : [];
    });
    return points.length > 1 ? [points] : [];
  });
  if (segments.length === 0) return [];

  const remaining = segments.slice(1);
  const path = [...segments[0]];
  while (remaining.length) {
    let bestIndex = 0;
    let reverse = false;
    let bestDistance = Number.POSITIVE_INFINITY;
    const end = path[path.length - 1];
    remaining.forEach((segment, index) => {
      const distanceToStart = distanceMeters(end, segment[0]);
      const distanceToEnd = distanceMeters(end, segment[segment.length - 1]);
      if (distanceToStart < bestDistance) {
        bestDistance = distanceToStart;
        bestIndex = index;
        reverse = false;
      }
      if (distanceToEnd < bestDistance) {
        bestDistance = distanceToEnd;
        bestIndex = index;
        reverse = true;
      }
    });
    const [segment] = remaining.splice(bestIndex, 1);
    path.push(...(reverse ? [...segment].reverse() : segment));
  }
  return path;
}

@Injectable({ providedIn: 'root' })
export class OriginSearchService {
  private readonly placeRequest = signal<PlaceRequest | null>(null);
  private readonly transitRequest = signal<TransitRequest | null>(null);

  readonly placesResource = httpResource<readonly PlaceSearchResult[]>(
    () => {
      const request = this.placeRequest();
      return request
        ? {
            url: 'https://nominatim.openstreetmap.org/search',
            params: {
              q: `${request.query}, ${request.city}`,
              format: 'jsonv2',
              limit: 6,
              countrycodes: 'de',
            },
            headers: {
              Accept: 'application/json',
              'Accept-Language': 'de',
            },
          }
        : undefined;
    },
    { defaultValue: [], parse: parsePlaces, debugName: 'origin-place-search' },
  );

  readonly transitResource = httpResource<readonly LatLng[]>(
    () => {
      const request = this.transitRequest();
      if (!request) return undefined;
      const safeReference = request.reference.replace(/["\\]/g, '');
      const safeType = request.routeType.replace(/[^a-z_]/g, '');
      const { south, west, north, east } = request.bounds;
      const query = `[out:json][timeout:25];relation["route"="${safeType}"]["ref"="${safeReference}"](${south},${west},${north},${east});way(r);out geom;`;
      return {
        url: 'https://overpass-api.de/api/interpreter',
        method: 'POST',
        body: query,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'text/plain;charset=UTF-8',
        },
      };
    },
    { defaultValue: [], parse: parseTransitPath, debugName: 'origin-transit-search' },
  );

  searchPlaces(query: string, city: string): void {
    this.placeRequest.set({ query, city });
  }

  searchTransit(
    reference: string,
    routeType: string,
    bounds: CityBounds,
  ): void {
    this.transitRequest.set({ reference, routeType, bounds });
  }
}
