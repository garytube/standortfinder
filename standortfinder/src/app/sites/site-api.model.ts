export type SiteIdentifier = string | number;
export type SiteApiValue = string | number;

export interface SiteMediaApiResponse {
  mediaName?: string | null;
}

export interface SiteFaceApiResponse {
  qid?: SiteApiValue | null;
  pps?: SiteApiValue | null;
  price?: number | null;
  media?: SiteMediaApiResponse | null;
  direction?: SiteApiValue | null;
  panelNumbers?: readonly SiteApiValue[] | null;
}

export interface SiteApiResponse {
  sid: SiteIdentifier;
  longitude: number;
  latitude: number;
  siteDescription?: string | null;
  city?: string | null;
  gkz?: SiteApiValue | null;
  plz?: SiteApiValue | null;
  imageIDs?: readonly SiteApiValue[] | null;
  faces?: readonly SiteFaceApiResponse[] | null;
}
