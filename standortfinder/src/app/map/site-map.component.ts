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
  geoJSON,
  latLng,
  latLngBounds,
  layerGroup,
  polygon,
  polyline,
  tileLayer,
  type GeoJSONOptions,
  type Layer,
  type LeafletMouseEvent,
  type Map as LeafletMap,
  type MapOptions,
} from 'leaflet';
import { FinderStore } from '../finder/finder.store';
import type { SiteFeature } from '../sites/site-geojson.model';

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
  private readonly baseLayer = tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    },
  );

  protected readonly options: MapOptions = {
    layers: [this.baseLayer],
    center: latLng(51.15, 10.45),
    zoom: 6,
    zoomControl: true,
  };

  private readonly siteLayer = computed(() => {
    const selected = this.store.selection();
    const options: GeoJSONOptions = {
      pointToLayer: (rawFeature, position) => {
        const feature = rawFeature as SiteFeature;
        const isSelected = this.store.isSiteSelected(feature);
        return circleMarker(position, {
          radius: isSelected ? 8 : 6,
          color: '#ffffff',
          weight: 2,
          fillColor: isSelected ? '#0067b9' : '#3399ff',
          fillOpacity: 0.95,
        });
      },
      onEachFeature: (rawFeature, layer) => {
        const feature = rawFeature as SiteFeature;
        const content = document.createElement('span');
        content.textContent =
          feature.properties.siteDescription || `Standort ${feature.properties.sid}`;
        layer.bindTooltip(content, { direction: 'top', offset: [0, -4] });
        layer.on('click', () => this.store.focusSite(feature));
      },
    };
    void selected;
    return geoJSON(this.store.filteredSites(), options);
  });

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
