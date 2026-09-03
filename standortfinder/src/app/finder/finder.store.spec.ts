import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SiteFeature, SitesGeoJson } from '../sites/site-geojson.model';
import { SitesService } from '../sites/sites.service';
import { FinderStore, panelSelectionKey } from './finder.store';

function feature(
  sid: number,
  city: string,
  longitude: number,
  latitude: number,
  faces: SiteFeature['properties']['faces'],
): SiteFeature {
  return {
    type: 'Feature',
    id: sid,
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties: {
      sid,
      city,
      siteDescription: `Standort ${sid}`,
      gkz: '',
      plz: '',
      imageIDs: [],
      faces,
    },
  };
}

describe('FinderStore', () => {
  const berlin = feature(1, 'Berlin', 13.405, 52.52, [
    { qid: 10, media: { mediaName: 'Poster' }, panelNumbers: [1, 2] },
    { qid: 11, media: { mediaName: 'Digital' }, panelNumbers: [3] },
  ]);
  const hamburg = feature(2, 'Hamburg', 9.9937, 53.5511, [
    { qid: 20, media: { mediaName: 'Poster' }, panelNumbers: [1] },
  ]);
  const nearbyBerlin = feature(3, 'Berlin', 13.406, 52.52, [
    { qid: 30, media: { mediaName: 'Poster' }, panelNumbers: [1] },
  ]);
  const sites = signal<SitesGeoJson>({
    type: 'FeatureCollection',
    features: [berlin, hamburg, nearbyBerlin],
  });
  let store: FinderStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FinderStore,
        {
          provide: SitesService,
          useValue: {
            sites,
            isLoading: signal(false),
            error: signal<unknown>(undefined),
            reload: () => true,
          },
        },
      ],
    });
    store = TestBed.inject(FinderStore);
    store.selectCity(null);
    store.clearSelection();
  });

  it('derives unique sorted cities and filters by city', () => {
    expect(store.cities()).toEqual(['Berlin', 'Hamburg']);
    store.selectCity('Berlin');
    expect(store.filteredFeatures().map((site) => site.properties.sid)).toEqual([1, 3]);
  });

  it('checks every face for media matches', () => {
    store.selectCity('Berlin');
    store.activeMedia.set(new Set(['Poster']));
    expect(store.filteredFeatures().map((site) => site.properties.sid)).toEqual([1, 3]);

    store.activeMedia.set(new Set(['Digital']));
    expect(store.filteredFeatures().map((site) => site.properties.sid)).toEqual([1]);
  });

  it('filters by radius around a point', () => {
    store.selectCity('Berlin');
    store.setRadius(200);
    store.setOrigin({
      type: 'point',
      label: 'Alexanderplatz',
      point: { lat: 52.52, lng: 13.405 },
    });

    expect(store.filteredFeatures().map((site) => site.properties.sid)).toEqual([1, 3]);
    store.setRadius(100);
    expect(store.filteredFeatures().map((site) => site.properties.sid)).toEqual([1, 3]);
  });

  it('toggles exact panels and counts sites and panels', () => {
    const firstKey = panelSelectionKey(1, berlin.properties.faces[0], 0, 1);
    const secondKey = panelSelectionKey(1, berlin.properties.faces[0], 0, 2);
    store.togglePanel(firstKey);
    store.togglePanel(secondKey);

    expect(store.selectedSiteCount()).toBe(1);
    expect(store.selectedPanelCount()).toBe(2);
    store.togglePanel(firstKey);
    expect(store.selection().has(firstKey)).toBe(false);
    expect(store.selectedPanelCount()).toBe(1);
  });

  it('preserves selection while changing city', () => {
    store.toggleSite(berlin);
    store.selectCity('Hamburg');
    expect(store.selectedSiteCount()).toBe(1);
    expect(store.selectedPanelCount()).toBe(3);
  });
});
