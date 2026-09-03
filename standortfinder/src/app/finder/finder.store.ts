import { computed, inject, Injectable, signal } from '@angular/core';
import {
  distanceMeters,
  distanceToPathMeters,
  pointInPolygon,
  type LatLng,
} from '../geo/distance';
import type { FinderOrigin, OriginMode } from '../geo/origin.model';
import type {
  SiteApiValue,
  SiteFaceApiResponse,
  SiteIdentifier,
} from '../sites/site-api.model';
import type { SiteFeature, SitesGeoJson } from '../sites/site-geojson.model';
import { SitesService } from '../sites/sites.service';

export interface SitePanel {
  readonly key: string;
  readonly feature: SiteFeature;
  readonly face: SiteFaceApiResponse | null;
  readonly faceIndex: number;
  readonly panel: SiteApiValue;
  readonly mediaName: string;
}

export interface SelectedSiteEntry {
  readonly feature: SiteFeature;
  readonly panels: readonly SitePanel[];
}

export interface CityBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

export function panelSelectionKey(
  sid: SiteIdentifier,
  face: SiteFaceApiResponse,
  faceIndex: number,
  panel: SiteApiValue,
): string {
  return `${sid}:${face.qid ?? faceIndex}:${panel}`;
}

export function panelsForSite(feature: SiteFeature): readonly SitePanel[] {
  const faces = feature.properties.faces;
  if (faces.length === 0) {
    return [
      {
        key: `${feature.properties.sid}:site:1`,
        feature,
        face: null,
        faceIndex: 0,
        panel: 1,
        mediaName: 'Werbefläche',
      },
    ];
  }

  return faces.flatMap((face, faceIndex) => {
    const panelNumbers = face.panelNumbers?.length ? face.panelNumbers : [1];
    return panelNumbers.map((panel) => ({
      key: panelSelectionKey(feature.properties.sid, face, faceIndex, panel),
      feature,
      face,
      faceIndex,
      panel,
      mediaName: face.media?.mediaName ?? 'Werbefläche',
    }));
  });
}

function pointOf(feature: SiteFeature): LatLng {
  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng };
}

function distanceFromOrigin(feature: SiteFeature, origin: FinderOrigin): number | null {
  const point = pointOf(feature);
  switch (origin.type) {
    case 'point':
      return distanceMeters(point, origin.point);
    case 'points':
      return Math.min(...origin.points.map((originPoint) => distanceMeters(point, originPoint)));
    case 'path':
      return distanceToPathMeters(point, origin.path);
    case 'polygon':
      return pointInPolygon(point, origin.polygon) ? 0 : null;
  }
}

@Injectable({ providedIn: 'root' })
export class FinderStore {
  private readonly sitesService = inject(SitesService);

  readonly sites = this.sitesService.sites;
  readonly isLoading = this.sitesService.isLoading;
  readonly error = this.sitesService.error;

  readonly selectedCity = signal<string | null>(null);
  readonly activeMedia = signal<ReadonlySet<string>>(new Set());
  readonly radiusMeters = signal(500);
  readonly origin = signal<FinderOrigin | null>(null);
  readonly selection = signal<ReadonlySet<string>>(new Set());
  readonly drawerOpen = signal(false);
  readonly requestDialogOpen = signal(false);
  readonly originPanelOpen = signal(false);
  readonly originMode = signal<OriginMode>(null);
  readonly drawingPolygon = signal(false);
  readonly focusedSiteId = signal<SiteIdentifier | null>(null);

  readonly cities = computed(() => {
    const values = this.sites().features.map((feature) => feature.properties.city);
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'de'));
  });

  readonly currentCityFeatures = computed(() => {
    const city = this.selectedCity();
    return city
      ? this.sites().features.filter((feature) => feature.properties.city === city)
      : this.sites().features;
  });

  readonly availableMedia = computed(() => {
    const values = this.currentCityFeatures().flatMap((feature) =>
      feature.properties.faces.length
        ? feature.properties.faces.map((face) => face.media?.mediaName ?? 'Werbefläche')
        : ['Werbefläche'],
    );
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'de'));
  });

  readonly filteredFeatures = computed(() => {
    const activeMedia = this.activeMedia();
    const origin = this.origin();
    const radius = this.radiusMeters();

    return this.currentCityFeatures()
      .filter((feature) => {
        if (activeMedia.size > 0) {
          const faces = feature.properties.faces;
          const matches = faces.length
            ? faces.some((face) => activeMedia.has(face.media?.mediaName ?? 'Werbefläche'))
            : activeMedia.has('Werbefläche');
          if (!matches) return false;
        }

        if (!origin) return true;
        const distance = distanceFromOrigin(feature, origin);
        return distance !== null && (origin.type === 'polygon' || distance <= radius);
      })
      .sort((left, right) =>
        left.properties.siteDescription.localeCompare(
          right.properties.siteDescription,
          'de',
          { numeric: true },
        ),
      );
  });

  readonly filteredSites = computed<SitesGeoJson>(() => ({
    type: 'FeatureCollection',
    features: this.filteredFeatures(),
  }));

  readonly resultCount = computed(() => this.filteredFeatures().length);

  readonly sitePanels = computed(() =>
    this.sites().features.flatMap((feature) => panelsForSite(feature)),
  );

  readonly selectedPanels = computed(() => {
    const selection = this.selection();
    return this.sitePanels().filter((panel) => selection.has(panel.key));
  });

  readonly selectedSiteCount = computed(
    () =>
      new Set(this.selectedPanels().map((panel) => panel.feature.properties.sid)).size,
  );
  readonly selectedPanelCount = computed(() => this.selectedPanels().length);

  readonly selectedEntries = computed<readonly SelectedSiteEntry[]>(() => {
    const bySite = new Map<SiteIdentifier, SelectedSiteEntry>();
    for (const panel of this.selectedPanels()) {
      const sid = panel.feature.properties.sid;
      const current = bySite.get(sid);
      bySite.set(sid, {
        feature: panel.feature,
        panels: current ? [...current.panels, panel] : [panel],
      });
    }

    return [...bySite.values()].sort((left, right) => {
      const cityComparison = left.feature.properties.city.localeCompare(
        right.feature.properties.city,
        'de',
      );
      return (
        cityComparison ||
        left.feature.properties.siteDescription.localeCompare(
          right.feature.properties.siteDescription,
          'de',
          { numeric: true },
        )
      );
    });
  });

  readonly selectedCities = computed(() => [
    ...new Set(
      this.selectedEntries().map((entry) => entry.feature.properties.city),
    ),
  ]);

  readonly cityBounds = computed<CityBounds | null>(() => {
    const features = this.currentCityFeatures();
    if (features.length === 0) return null;
    const points = features.map(pointOf);
    return {
      south: Math.min(...points.map((point) => point.lat)),
      west: Math.min(...points.map((point) => point.lng)),
      north: Math.max(...points.map((point) => point.lat)),
      east: Math.max(...points.map((point) => point.lng)),
    };
  });

  constructor() {
    if (typeof location === 'undefined') return;
    const parameters = new URLSearchParams(location.hash.replace(/^#/, ''));
    const city = parameters.get('stadt');
    const media = parameters.get('medien');
    const selection = parameters.getAll('flaeche');
    if (city) this.selectedCity.set(city);
    if (media) this.activeMedia.set(new Set(media.split('~').filter(Boolean)));
    if (selection.length) this.selection.set(new Set(selection));
  }

  selectCity(city: string | null): void {
    this.selectedCity.set(city);
    this.activeMedia.set(new Set());
    this.origin.set(null);
    this.originMode.set(null);
    this.drawingPolygon.set(false);
  }

  toggleMedia(media: string): void {
    const available = this.availableMedia();
    this.activeMedia.update((current) => {
      const next = current.size === 0 ? new Set(available) : new Set(current);
      if (next.has(media)) {
        if (next.size === 1) return current;
        next.delete(media);
      } else {
        next.add(media);
      }
      return next.size === available.length ? new Set() : next;
    });
  }

  isMediaActive(media: string): boolean {
    const active = this.activeMedia();
    return active.size === 0 || active.has(media);
  }

  clearMediaFilter(): void {
    this.activeMedia.set(new Set());
  }

  setRadius(meters: number): void {
    this.radiusMeters.set(Math.max(100, Math.min(5_000, Math.round(meters))));
  }

  setOrigin(origin: FinderOrigin | null): void {
    this.origin.set(origin);
    this.drawingPolygon.set(false);
  }

  setOriginMode(mode: OriginMode): void {
    this.originMode.set(mode);
    this.originPanelOpen.set(mode !== null);
    this.drawingPolygon.set(mode === 'polygon');
  }

  togglePanel(key: string): void {
    this.selection.update((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  toggleSite(feature: SiteFeature): void {
    const keys = panelsForSite(feature).map((panel) => panel.key);
    this.selection.update((current) => {
      const next = new Set(current);
      const allSelected = keys.every((key) => next.has(key));
      for (const key of keys) allSelected ? next.delete(key) : next.add(key);
      return next;
    });
  }

  removeSite(feature: SiteFeature): void {
    const keys = panelsForSite(feature).map((panel) => panel.key);
    this.selection.update((current) => {
      const next = new Set(current);
      for (const key of keys) next.delete(key);
      return next;
    });
  }

  isSiteSelected(feature: SiteFeature): boolean {
    const selection = this.selection();
    return panelsForSite(feature).some((panel) => selection.has(panel.key));
  }

  selectAllFiltered(): void {
    this.selection.update((current) => {
      const next = new Set(current);
      for (const feature of this.filteredFeatures()) {
        for (const panel of panelsForSite(feature)) next.add(panel.key);
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selection.set(new Set());
  }

  focusSite(feature: SiteFeature): void {
    this.focusedSiteId.set(feature.properties.sid);
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  openRequestDialog(): void {
    this.requestDialogOpen.set(true);
  }

  closeRequestDialog(): void {
    this.requestDialogOpen.set(false);
  }

  reloadSites(): boolean {
    return this.sitesService.reload();
  }

  shareUrl(): string {
    if (typeof location === 'undefined') return '';
    const parameters = new URLSearchParams();
    const city = this.selectedCity();
    const media = this.activeMedia();
    if (city) parameters.set('stadt', city);
    if (media.size) parameters.set('medien', [...media].join('~'));
    for (const key of this.selection()) parameters.append('flaeche', key);
    return `${location.href.split('#')[0]}#${parameters.toString()}`;
  }
}
