import type { Feature, FeatureCollection, Point } from 'geojson';
import type {
  SiteApiValue,
  SiteFaceApiResponse,
  SiteIdentifier,
} from './site-api.model';

export interface SiteFeatureProperties {
  sid: SiteIdentifier;
  siteDescription: string;
  city: string;
  gkz: string;
  plz: string;
  imageIDs: readonly SiteApiValue[];
  faces: readonly SiteFaceApiResponse[];
}

export type SiteFeature = Feature<Point, SiteFeatureProperties>;
export type SitesGeoJson = FeatureCollection<Point, SiteFeatureProperties>;

export const EMPTY_SITES_GEOJSON: SitesGeoJson = {
  type: 'FeatureCollection',
  features: [],
};
