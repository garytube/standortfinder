import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  LeafletDirective,
  LeafletLayersDirective,
} from '@bluehalo/ngx-leaflet';
import {
  circle,
  circleMarker,
  divIcon,
  geoJSON,
  latLng,
  latLngBounds,
  layerGroup,
  marker,
  polygon,
  polyline,
  tileLayer,
  type GeoJSONOptions,
  type Layer,
  type LeafletMouseEvent,
  type Map as LeafletMap,
  type MapOptions,
} from 'leaflet';
import { mediaIconDataUri, siteMarkerIcon } from './site-marker-icon';
import { FinderStore } from '../finder/finder.store';
import type { SiteFaceApiResponse } from '../sites/site-api.model';
import type { SiteFeature } from '../sites/site-geojson.model';

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const ESRI_CANVAS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
const ESRI_ATTRIBUTION =
  'Kartengrundlage: Esri, HERE, Garmin, &copy; OpenStreetMap-Mitwirkende';

@Component({
  selector: 'app-site-map',
  imports: [LeafletDirective, LeafletLayersDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-map.component.html',
  styleUrl: './site-map.component.css',
})
export class SiteMapComponent {
  protected readonly store = inject(FinderStore);
  private readonly map = signal<LeafletMap | null>(null);
  private readonly drawingPoints = signal<readonly [number, number][]>([]);
  private readonly priceFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
  private readonly baseLayer = tileLayer(
    `${ESRI_CANVAS_URL}World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    {
      maxNativeZoom: 16,
      maxZoom: 19,
      attribution: ESRI_ATTRIBUTION,
    },
  );
  private readonly referenceLayer = tileLayer(
    `${ESRI_CANVAS_URL}World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    {
      maxNativeZoom: 16,
      maxZoom: 19,
      attribution: '',
      pane: 'overlayPane',
    },
  );

  protected readonly options: MapOptions = {
    layers: [this.baseLayer, this.referenceLayer],
    center: latLng(51.15, 10.45),
    zoom: 6,
    zoomControl: true,
  };

  private readonly cityLayer = computed<Layer>(() => {
    if (this.store.selectedCity()) return layerGroup();

    const byCity = new Map<string, SiteFeature[]>();
    for (const feature of this.store.sites().features) {
      const city = feature.properties.city;
      const features = byCity.get(city);
      if (features) {
        features.push(feature);
      } else {
        byCity.set(city, [feature]);
      }
    }

    const cityMarkers = [...byCity.entries()].map(([city, features]) => {
      const bounds = latLngBounds(
        features.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          return [lat, lng];
        }),
      );
      return marker(bounds.getCenter(), {
        icon: this.cityMarkerIcon(city, features.length),
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: features.length,
      }).on('click', () => this.store.selectCity(city));
    });

    return layerGroup(cityMarkers);
  });

  private readonly siteLayer = computed<Layer>(() => {
    const city = this.store.selectedCity();
    if (!city) return layerGroup();

    const selected = this.store.selection();
    const activeMedia = this.store.activeMedia();
    const options: GeoJSONOptions = {
      pointToLayer: (rawFeature, position) => {
        const feature = rawFeature as SiteFeature;
        const isSelected = this.store.isSiteSelected(feature);
        const mediaName = this.mediaNameFor(feature, activeMedia);
        return marker(position, {
          icon: siteMarkerIcon(mediaName, isSelected),
        });
      },
      onEachFeature: (rawFeature, layer) => {
        const feature = rawFeature as SiteFeature;
        layer.bindPopup(
          () => this.sitePopupContent(feature, activeMedia),
          { closeButton: true, offset: [0, -4] },
        );
        layer.on('click', () => this.store.focusSite(feature));
      },
    };
    void selected;
    return geoJSON(this.store.filteredSites(), options);
  });

  private cityMarkerIcon(city: string, count: number) {
    const escapedCity = city.replace(
      /[&<>"']/g,
      (character) => HTML_ENTITIES[character],
    );
    return divIcon({
      className: '',
      html: `<span class="city-marker"><span class="city-marker-dot"></span><span class="city-marker-name">${escapedCity}<em>${count}</em></span></span>`,
      iconSize: [140, 28],
      iconAnchor: [7, 7],
    });
  }

  private sitePopupContent(
    feature: SiteFeature,
    activeMedia: ReadonlySet<string>,
  ): HTMLElement {
    const face = this.faceFor(feature, activeMedia);
    const mediaName = face?.media?.mediaName ?? 'Werbefläche';
    const popup = document.createElement('div');
    popup.className = 'site-popup';

    const icon = document.createElement('span');
    icon.className = 'site-popup-icon';
    icon.style.backgroundImage = `url("${mediaIconDataUri(mediaName)}")`;
    popup.append(icon);

    const title = document.createElement('h4');
    title.textContent = feature.properties.siteDescription || 'Werbefläche';
    popup.append(title);

    const identifier = document.createElement('p');
    identifier.className = 'site-popup-id';
    identifier.textContent = `Standort ${feature.properties.sid}`;
    popup.append(identifier);

    const rows: readonly [string, string | number | null | undefined][] = [
      ['Werbeträger', mediaName],
      ['Wirkungsrichtung', face?.direction],
      ['PPS', face?.pps],
      ['Flächen', face?.panelNumbers?.length || 1],
      [
        'Preis pro Tag',
        face?.price === null || face?.price === undefined
          ? null
          : this.priceFormatter.format(face.price),
      ],
    ];
    for (const [label, value] of rows) {
      if (value === null || value === undefined || value === '') continue;
      const row = document.createElement('div');
      row.className = 'site-popup-row';
      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      const valueElement = document.createElement('span');
      valueElement.textContent = String(value);
      row.append(labelElement, valueElement);
      popup.append(row);
    }

    const action = document.createElement('button');
    const selected = this.store.isSiteSelected(feature);
    action.type = 'button';
    action.className = selected
      ? 'site-popup-action is-selected'
      : 'site-popup-action';
    action.textContent = selected ? 'Entfernen' : 'Zur Auswahl';
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      this.store.toggleSite(feature);
    });
    popup.append(action);

    return popup;
  }

  private faceFor(
    feature: SiteFeature,
    activeMedia: ReadonlySet<string>,
  ): SiteFaceApiResponse | undefined {
    return feature.properties.faces.find(
      (face) =>
        activeMedia.size === 0 ||
        activeMedia.has(face.media?.mediaName ?? 'Werbefläche'),
    );
  }

  private mediaNameFor(
    feature: SiteFeature,
    activeMedia: ReadonlySet<string>,
  ): string {
    return this.faceFor(feature, activeMedia)?.media?.mediaName ?? 'Werbefläche';
  }

  private readonly originLayer = computed<Layer>(() => {
    const origin = this.store.origin();
    const drawingPoints = this.drawingPoints();
    const radius = this.store.radiusMeters();
    const layers: Layer[] = [];

    if (origin?.type === 'point') {
      layers.push(
        circle([origin.point.lat, origin.point.lng], {
          radius,
          color: '#0067b9',
          weight: 2,
          fillColor: '#3399ff',
          fillOpacity: 0.12,
        }),
        circleMarker([origin.point.lat, origin.point.lng], {
          radius: 7,
          color: '#000000',
          weight: 2,
          fillColor: '#f1d432',
          fillOpacity: 1,
        }),
      );
    } else if (origin?.type === 'points') {
      for (const point of origin.points) {
        layers.push(
          circle([point.lat, point.lng], {
            radius,
            color: '#0067b9',
            weight: 1,
            fillColor: '#3399ff',
            fillOpacity: 0.08,
          }),
          circleMarker([point.lat, point.lng], {
            radius: 5,
            color: '#000000',
            weight: 1,
            fillColor: '#f1d432',
            fillOpacity: 1,
          }),
        );
      }
    } else if (origin?.type === 'path') {
      layers.push(
        polyline(
          origin.path.map((point) => [point.lat, point.lng]),
          { color: '#0067b9', weight: 5, opacity: 0.85 },
        ),
      );
    } else if (origin?.type === 'polygon') {
      layers.push(
        polygon(
          origin.polygon.map((point) => [point.lat, point.lng]),
          {
            color: '#0067b9',
            weight: 3,
            fillColor: '#3399ff',
            fillOpacity: 0.15,
          },
        ),
      );
    }

    if (this.store.drawingPolygon() && drawingPoints.length > 0) {
      layers.push(
        polyline([...drawingPoints], {
          color: '#0067b9',
          weight: 3,
          dashArray: '7 6',
        }),
      );
      for (const point of drawingPoints) {
        layers.push(
          circleMarker(point, {
            radius: 5,
            color: '#0067b9',
            fillColor: '#ffffff',
            fillOpacity: 1,
          }),
        );
      }
    }

    return layerGroup(layers);
  });

  protected readonly layers = computed<Layer[]>(() => [
    this.cityLayer(),
    this.siteLayer(),
    this.originLayer(),
  ]);

  constructor() {
    effect(() => {
      const map = this.map();
      const city = this.store.selectedCity();
      const features = this.store.currentCityFeatures();
      if (!map) return;
      if (!city) {
        map.setView([51.15, 10.45], 6, { animate: false });
      } else if (features.length) {
        const bounds = latLngBounds(
          features.map((feature) => {
            const [lng, lat] = feature.geometry.coordinates;
            return [lat, lng];
          }),
        );
        map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
      }
    });

    effect(() => {
      const map = this.map();
      const focusedId = this.store.focusedSiteId();
      if (!map || focusedId === null) return;
      const feature = this.store
        .sites()
        .features.find((site) => site.properties.sid === focusedId);
      if (!feature) return;
      const [lng, lat] = feature.geometry.coordinates;
      map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
    });

    effect(() => {
      if (!this.store.drawingPolygon()) this.drawingPoints.set([]);
    });
  }

  protected onMapReady(map: LeafletMap): void {
    this.map.set(map);
  }

  protected onMapClick(event: LeafletMouseEvent): void {
    if (!this.store.drawingPolygon()) return;
    this.drawingPoints.update((points) => [
      ...points,
      [event.latlng.lat, event.latlng.lng],
    ]);
  }

  protected onMapDoubleClick(event: LeafletMouseEvent): void {
    if (!this.store.drawingPolygon()) return;
    event.originalEvent.preventDefault();
    const points = this.drawingPoints();
    if (points.length < 3) return;
    this.store.setOrigin({
      type: 'polygon',
      label: 'Eigenes Gebiet',
      polygon: points.map(([lat, lng]) => ({ lat, lng })),
    });
  }
}
