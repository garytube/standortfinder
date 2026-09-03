import type { LatLng } from './distance';

export type FinderOrigin =
  | { readonly type: 'point'; readonly label: string; readonly point: LatLng }
  | { readonly type: 'points'; readonly label: string; readonly points: readonly LatLng[] }
  | { readonly type: 'path'; readonly label: string; readonly path: readonly LatLng[] }
  | { readonly type: 'polygon'; readonly label: string; readonly polygon: readonly LatLng[] };

export type OriginMode = 'address' | 'poi' | 'route' | 'polygon' | null;
