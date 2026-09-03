# Standortfinder — Angular 22+ Build Plan

## 0. Mission

Rebuild the existing Standortfinder prototype as a clean Angular 22+ application.

This is **not** a greenfield design exercise and **not** a framework showcase. The goal is to preserve the UX and behavior of the existing prototype while replacing the monolithic HTML/JavaScript implementation with a small, understandable Angular application.

The coding agent should optimize for:

1. simplicity,
2. readable Angular 22+ code,
3. Signals-first state,
4. no manual RxJS subscriptions,
5. direct use of Leaflet through `@bluehalo/ngx-leaflet`,
6. the real Standortfinder API,
7. minimal dependencies,
8. easy future deletion of temporary compatibility code.

Do not build abstractions unless they are already justified by the current application.

---

# 1. Existing project: important assumptions

The Angular project already exists and was created with:

```bash
ng new app-name
```

**Do not run `ng new` again.**

Work inside the existing Angular application and preserve the generated project/tooling unless a concrete change is required.

The visual/behavioral reference will be available under:

```text
/template/
```

The primary prototype is expected to be:

```text
/template/standortfinder-konzept-v5-neueTabelle.html
```

Treat `/template` as reference material only. Do not serve the old application from there and do not copy its monolithic JS architecture into Angular.

The temporary API conversion logic is based on:

```text
standortfinder-sites-api.js
```

Its important behavior is described in section 5 below.

---

# 2. Hard technical decisions

Use these decisions unless the existing generated project makes a tiny adjustment necessary.

## Framework

- Angular **22+**
- standalone components
- strict TypeScript
- Angular built-in template control flow (`@if`, `@for`, `@switch`)
- Signals for application/UI state
- `computed()` for derived state
- `effect()` only where an imperative browser/Leaflet side effect is actually necessary
- `httpResource()` for GET/read HTTP data
- Signal Forms from `@angular/forms/signals` when a real form is needed

## Map

Use:

```text
Leaflet
@bluehalo/ngx-leaflet
OpenStreetMap tiles initially
```

Do **not** use Google Maps.

Do **not** introduce a generic `MapAdapter` or provider abstraction at this stage. Leaflet is the chosen map implementation. Keep Leaflet-specific objects local to the map feature/component so they do not leak into global application state.

## State

Use plain Angular Signals.

Do **not** add:

- NgRx
- Elf
- Akita
- RxAngular state
- custom event bus
- Redux-style reducers

A small injectable `FinderStore` service backed by signals is enough.

## RxJS

Avoid application-authored RxJS unless an API genuinely cannot be expressed cleanly without it.

**Hard rule:** there should be no manual `.subscribe()` calls in `src/app`.

Do not solve normal Angular state with Subjects, BehaviorSubjects, `combineLatest`, `switchMap`, etc. when signals / `httpResource` already solve the problem.

## Forms

For the request/contact form, use Angular Signal Forms if/when the form is implemented:

```ts
import { form, FormField, required, email } from '@angular/forms/signals';
```

Do not use classic Reactive Forms by default in this project.

For simple UI controls such as media chips, city buttons and radius controls, use signals and normal Angular event bindings; no form library is required.

## Styling

- reuse/adapt the existing prototype CSS
- keep CSS simple
- no Tailwind
- no Angular Material unless explicitly requested later
- no new design system

## Routing

The Standortfinder is initially one application screen.

Do not add routes just to create architecture. If the generated project already has routing, leaving it configured is fine, but the feature does not need route-per-panel navigation.

---

# 3. Dependencies

Install only what is needed for Leaflet.

```bash
npm install leaflet @bluehalo/ngx-leaflet
npm install --save-dev @types/leaflet @types/geojson
```

Add Leaflet CSS to the Angular build. Prefer `src/styles.css`:

```css
@import 'leaflet/dist/leaflet.css';
```

If the existing build setup prefers `angular.json`, using the styles array is also acceptable.

Avoid Leaflet's default image marker assets if possible. Prefer `circleMarker()` or `divIcon()` for Standortfinder markers so there is no marker-image asset path problem.

Do not add a clustering library on day one. Only add marker clustering if actual rendering performance with the real API requires it.

---

# 4. Real upstream API

Use the real API:

```text
https://standortfinder.wall.de/api/sites?year=2026
```

The application should use a `year` signal so changing the year later does not require rewriting the HTTP layer.

Start with:

```ts
readonly year = signal(2026);
```

A simple constant is enough for the endpoint:

```ts
export const SITES_API_URL = 'https://standortfinder.wall.de/api/sites';
```

Do not build a runtime configuration framework just for one URL.

If local browser development hits CORS restrictions, add a small Angular dev proxy and switch the development URL to `/api/sites`. Do not redesign the service because of local CORS.

---

# 5. API -> GeoJSON compatibility layer

The API currently returns site JSON, not GeoJSON.

For now Angular must convert the response to GeoJSON. This is temporary compatibility code and should be isolated so it can be deleted when the upstream API returns GeoJSON directly.

The supplied `standortfinder-sites-api.js` establishes the required behavior:

1. the response must be an array,
2. discard sites without finite `longitude` and `latitude`,
3. each site becomes one GeoJSON `Point` feature,
4. feature ID is `site.sid`,
5. coordinates are `[longitude, latitude]`,
6. preserve these properties:
   - `sid`
   - `siteDescription`
   - `city`
   - `gkz`
   - `plz`
   - `imageIDs`
   - `faces`

The old helper also flattened GeoJSON back into rows. **Do not port that row conversion unless the Angular implementation proves it is required.** Angular should work directly with the API/GeoJSON types.

## Typed API model

Create:

```text
src/app/sites/site-api.model.ts
```

Use types shaped around the real response, for example:

```ts
export interface SiteApiResponse {
  sid: string;
  longitude: number;
  latitude: number;
  siteDescription?: string | null;
  city?: string | null;
  gkz?: string | null;
  plz?: string | null;
  imageIDs?: readonly string[] | null;
  faces?: readonly SiteFaceApiResponse[] | null;
}

export interface SiteFaceApiResponse {
  qid?: string | null;
  pps?: string | null;
  price?: number | null;
  media?: {
    mediaName?: string | null;
  } | null;
  direction?: string | null;
  panelNumbers?: readonly (string | number)[] | null;
}
```

Adjust property types only when the real endpoint demonstrates a different shape. Do not invent fields.

## GeoJSON properties

Create:

```text
src/app/sites/site-geojson.model.ts
```

Prefer standard GeoJSON types:

```ts
import type { FeatureCollection, Point } from 'geojson';

export interface SiteFeatureProperties {
  sid: string;
  siteDescription: string;
  city: string;
  gkz: string;
  plz: string;
  imageIDs: readonly string[];
  faces: readonly SiteFaceApiResponse[];
}

export type SitesGeoJson = FeatureCollection<Point, SiteFeatureProperties>;
```

## Converter

Create a pure function:

```text
src/app/sites/sites-to-geojson.ts
```

Conceptually:

```ts
export function sitesToGeoJson(raw: unknown): SitesGeoJson {
  if (!Array.isArray(raw)) {
    throw new Error('Standort-API liefert keine Liste');
  }

  const sites = raw as SiteApiResponse[];

  return {
    type: 'FeatureCollection',
    features: sites
      .filter(site =>
        Number.isFinite(site.longitude) &&
        Number.isFinite(site.latitude)
      )
      .map(site => ({
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
          gkz: site.gkz ?? '',
          plz: site.plz ?? '',
          imageIDs: site.imageIDs ?? [],
          faces: site.faces ?? [],
        },
      })),
  };
}
```

Keep this function framework-independent and unit test it.

When the API later returns GeoJSON, the planned migration should be approximately:

```text
remove sitesToGeoJson()
change httpResource parse/type
keep FinderStore + components unchanged
```

That is the boundary we want.

---

# 6. Sites service with `httpResource`

Create:

```text
src/app/sites/sites.service.ts
```

The service owns the HTTP resource and exposes signal-based read state.

Use `httpResource`, not `HttpClient.get(...).subscribe(...)`.

Recommended shape:

```ts
import { Injectable, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';

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
      defaultValue: {
        type: 'FeatureCollection',
        features: [],
      },
      parse: sitesToGeoJson,
      debugName: 'standortfinder-sites',
    },
  );

  readonly sites = this.resource.value;
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;
}
```

Exact method signatures may need tiny adjustments to match the installed Angular version, but preserve the design:

```text
httpResource -> parse API response -> GeoJSON -> expose signals
```

Do not create an Observable wrapper around the resource.

Do not manually subscribe.

Do not fetch the same endpoint again in components.

Ensure `provideHttpClient()` is present in `app.config.ts` if it is not already configured.

---

# 7. Application state: one small `FinderStore`

Create:

```text
src/app/finder/finder.store.ts
```

This service owns UI/business state only. It consumes the `SitesService` signals.

Keep it deliberately small.

Suggested writable signals:

```ts
readonly selectedCity = signal<string | null>(null);
readonly activeMedia = signal<ReadonlySet<string>>(new Set());
readonly radiusMeters = signal(500);
readonly origin = signal<LatLng | null>(null);
readonly selection = signal<ReadonlySet<string>>(new Set());
readonly drawerOpen = signal(false);
```

Use immutable Set updates:

```ts
this.activeMedia.update(current => {
  const next = new Set(current);
  // mutate next
  return next;
});
```

Do not mutate a Set stored inside a signal without returning a new Set.

## Derived state

Use `computed()` for:

- unique city list
- current city features
- available media names
- filtered site features
- result count
- selected site count
- selected panel count
- selected entries for the drawer/export

Example direction:

```ts
readonly cities = computed(() => {
  const values = this.sites().features.map(f => f.properties.city);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'de'));
});
```

Do not duplicate derived data into writable state.

---

# 8. Faces, media and panel selection

The API already exposes `faces` on each site. Keep them intact on GeoJSON properties.

Do not reproduce the prototype bug where a site inherits media/price from only the first face.

## Media filtering

A site matches the media filter when at least one face matches an active media name.

Conceptually:

```ts
function siteMatchesMedia(
  feature: SiteFeature,
  activeMedia: ReadonlySet<string>,
): boolean {
  if (activeMedia.size === 0) return true;

  return feature.properties.faces.some(face =>
    activeMedia.has(face.media?.mediaName ?? 'Werbefläche')
  );
}
```

If the UI displays prices or media labels for a site with multiple faces, derive the display from the matching faces rather than using `faces[0]` blindly.

## Stable selection keys

Selection must support individual panels/surfaces.

Prefer real identifiers from the API when available.

A simple key helper is enough:

```ts
function panelSelectionKey(
  sid: string,
  face: SiteFaceApiResponse,
  faceIndex: number,
  panel: string | number,
): string {
  return `${sid}:${face.qid ?? faceIndex}:${panel}`;
}
```

If a face has no `panelNumbers`, treat it as one selectable surface using a deterministic fallback such as `1`.

Do not create random selection IDs.

---

# 9. Geo/radius filtering

Keep geographic calculations as pure TypeScript helpers.

Create:

```text
src/app/geo/distance.ts
```

For the first implementation, only implement the geometry actually needed by the prototype.

At minimum:

```ts
export interface LatLng {
  lat: number;
  lng: number;
}

export function distanceMeters(a: LatLng, b: LatLng): number;
```

Use Haversine distance or port the prototype's verified point-distance logic.

Then:

```text
no origin -> city/media filtered sites
origin -> city/media filtered sites inside radius
```

Do not bring in Turf.js for one distance calculation.

If route/polygon origins from the prototype are implemented later, add only the geometry helpers needed for those modes.

---

# 10. Leaflet implementation

Use `@bluehalo/ngx-leaflet` in a standalone component.

Create:

```text
src/app/map/site-map.component.ts
src/app/map/site-map.component.html
src/app/map/site-map.component.css
```

Import the standalone Leaflet directives directly into the component.

Example direction:

```ts
import {
  LeafletDirective,
  LeafletLayersDirective,
} from '@bluehalo/ngx-leaflet';
```

Use whichever specific directives are exported by the installed package version. Do not fall back to creating an NgModule solely for Leaflet.

## Base layer

Use an OSM tile layer initially:

```ts
tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
});
```

Keep attribution visible.

## Site layer

Use the GeoJSON coming from `FinderStore.filteredSites()`.

A simple approach is preferred:

```ts
readonly siteLayer = computed(() =>
  geoJSON(this.store.filteredSites(), {
    pointToLayer: (feature, latlng) =>
      circleMarker(latlng, markerStyleForFeature(feature)),
    onEachFeature: (feature, layer) => {
      // popup / click handling
    },
  })
);
```

Then expose a Leaflet layers array to the directive.

If creating the entire GeoJSON layer on every relevant change proves slow with the real dataset, optimize **after measuring**. Do not start by writing a custom marker-diff engine.

## Leaflet object ownership

Allowed:

```text
SiteMapComponent owns Leaflet Map/Layer objects
```

Not allowed:

```text
FinderStore stores Leaflet Map/Marker/Layer objects
SitesService stores Leaflet objects
API models contain Leaflet objects
```

## Map ready / imperative operations

It is acceptable for the map component to keep the Leaflet map instance after `(leafletMapReady)`.

Use normal event handlers and, where necessary, one small Angular `effect()` to perform imperative operations such as:

- `fitBounds()` after city changes
- `invalidateSize()` when a drawer/layout change affects map size
- focus/pan to a selected result

This is a valid use of `effect()` because Leaflet is an imperative external library.

Do not create RxJS subscriptions for these operations.

---

# 11. Component structure

Keep the component tree coarse-grained at first.

Recommended starting structure:

```text
src/app/
  app.component.*

  finder/
    finder-page.component.*
    finder.store.ts

  sites/
    site-api.model.ts
    site-geojson.model.ts
    sites-to-geojson.ts
    sites-to-geojson.spec.ts
    sites.service.ts

  geo/
    distance.ts
    distance.spec.ts

  map/
    site-map.component.*

  city-picker/
    city-picker.component.*

  filters/
    media-filter.component.*
    radius-filter.component.*

  origin/
    origin-panel.component.*

  results/
    result-list.component.*
    result-card.component.*

  selection/
    selection-dock.component.*
    selection-drawer.component.*

  request/
    request-dialog.component.*
```

Do not create empty architecture folders such as `core`, `shared`, `domain`, `application`, `infrastructure`, `ports`, `adapters` unless actual reusable code appears that belongs there.

A flat feature-oriented structure is preferred.

If a component remains tiny and is used once, keeping it in the parent is fine.

---

# 12. UI migration from `/template`

The prototype is the source of truth for:

- layout
- German labels/copy
- city selection flow
- media filter behavior
- radius behavior
- result cards
- result count
- selection dock
- selection drawer
- dialogs
- mobile presentation
- colors/spacing/visual hierarchy

The implementation order should be behavioral first, visual polish second.

## Do not port these patterns

Do not copy:

- global `S` object
- `document.querySelector()` state management
- `innerHTML` render functions
- generic `refresh()`
- manual DOM event registration for normal Angular controls
- global marker arrays
- string-built UI HTML

Use Angular templates and Signals instead.

## Direct DOM access

Avoid direct DOM access for normal UI.

If direct DOM/browser APIs are genuinely needed, keep them inside the specific component and prefer Angular APIs (`viewChild`, `ElementRef`, `Renderer2`) where appropriate.

Leaflet itself is an explicit exception because it owns its map DOM.

---

# 13. Suggested finder-page flow

`FinderPageComponent` should mostly compose features.

Conceptually:

```html
<app-topbar />

<main class="finder-layout">
  <app-site-map />
  <app-origin-panel />
  <app-result-list />
</main>

<app-selection-dock />
<app-selection-drawer />
<app-request-dialog />
```

Avoid putting all business logic into `FinderPageComponent`.

Most stateful actions should be methods on `FinderStore`, e.g.:

```ts
selectCity(city: string): void;
toggleMedia(media: string): void;
setRadius(meters: number): void;
setOrigin(origin: LatLng | null): void;
togglePanel(key: string): void;
clearSelection(): void;
openDrawer(): void;
closeDrawer(): void;
```

---

# 14. Loading and error UI

Use the `httpResource` state signals directly.

The UI must show:

```text
loading -> simple loading state
error -> useful German error message + retry button
ready, zero sites -> empty state
ready, sites -> normal finder
```

The retry button should call the resource reload API rather than constructing another HTTP service/request path.

Do not swallow API errors.

Do not silently switch to fake/random demo data when production API loading fails.

If fixtures are useful for tests, keep them in test files only.

---

# 15. Signal Forms for the request dialog

Only implement this when the request dialog is in scope for the current build phase.

Example model:

```ts
interface RequestFormModel {
  salutation: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  period: string;
  message: string;
  privacyAccepted: boolean;
}
```

Create the model as a writable signal:

```ts
readonly model = signal<RequestFormModel>({ ... });
```

Then:

```ts
readonly requestForm = form(this.model, path => {
  required(path.firstName);
  required(path.lastName);
  required(path.email);
  email(path.email);
  required(path.privacyAccepted);
});
```

Use `FormField` bindings in the template.

Do not implement request submission using a `.subscribe()`.

If the actual quote-request backend is not yet available, keep submit behavior clearly marked as TODO/mock and do not show a false production success message.

---

# 16. Search/origin features

Do not overbuild these before the core real-data finder works.

Implement in this priority order:

1. city selection,
2. media filtering,
3. map/result synchronization,
4. selection,
5. a simple point origin + radius,
6. only then additional origin modes from the prototype.

For address/POI search, stay on open data/open-source-oriented services where practical. Do not add Google Places.

If Nominatim is used, encapsulate the HTTP call in one small service and respect the provider's usage policy. Do not add it until the product flow needs it.

For route/polygon drawing, use Leaflet-native/open-source options only and add dependencies only if the prototype behavior cannot be implemented simply with Leaflet itself.

---

# 17. Sharing and URL state

Do not make sharing architecture a prerequisite for the first working finder.

When implemented, share the **actual selection**, not just SIDs.

The prototype previously had a potential mismatch where restoring a shared SID could reselect every panel on that site. Avoid that.

A simple first implementation can encode stable selection keys and filter state in `URLSearchParams` if URLs remain reasonable.

Do not build a backend short-link service until needed.

---

# 18. CSV export

Keep export client-side and simple.

Build rows from the current exact panel selection and create a Blob download.

Do not pull in an export library for CSV.

Reuse the field names expected by the existing business workflow where the template/prototype establishes them.

---

# 19. Testing

Keep the test suite focused on logic that can regress.

## Required unit tests

### `sites-to-geojson.spec.ts`

Test at least:

1. rejects a non-array API response,
2. filters invalid coordinates,
3. creates `[longitude, latitude]` point geometry,
4. uses SID as feature ID,
5. applies default strings/arrays,
6. preserves `faces`,
7. handles empty API array.

### `distance.spec.ts`

Test known points and zero distance.

### `finder.store.spec.ts`

Test at least:

1. unique city derivation,
2. city filtering,
3. media filtering checks all faces rather than only first face,
4. radius filtering,
5. selection toggle,
6. selection survives city change,
7. panel counts are correct.

## Component tests

Add component tests only for behavior that is awkward to prove through store/unit tests.

Do not write tests that merely assert a component was created.

## End-to-end

Do not add Playwright/Cypress solely because a plan says so. If E2E tooling is already installed, add one happy-path test. Otherwise the first delivery can rely on unit tests + manual prototype comparison.

---

# 20. No-subscription acceptance rule

Before considering the implementation complete, run a source search.

There should be no application-authored manual subscriptions:

```bash
grep -R "\.subscribe(" src/app || true
```

Expected result:

```text
no matches
```

If a library type forces an Observable for an isolated integration, first look for a signal/event-handler/resource solution. Only violate this rule with a clear comment explaining why it is unavoidable.

---

# 21. Build phases

Implement in small working slices. The app should build at the end of every phase.

## Phase 1 — inspect and establish baseline

1. Inspect existing generated Angular project.
2. Inspect `/template/standortfinder-konzept-v5-neueTabelle.html`.
3. Identify visual tokens and main UI regions.
4. Run existing tests/build before changes.
5. Do not regenerate the project.

Exit criteria:

```bash
npm test -- --watch=false
ng build
```

(or the equivalent commands configured by the project) succeed before substantial work starts.

## Phase 2 — Leaflet + real API

1. install Leaflet dependencies,
2. configure Leaflet CSS,
3. create API types,
4. port `sitesToGeoJson`,
5. create `SitesService` with `httpResource`,
6. display basic loading/error/site-count UI,
7. create a simple Leaflet map,
8. render all valid sites.

Exit criteria:

- real API request is used,
- no subscriptions,
- sites appear on OSM map,
- invalid coordinates do not break the map,
- converter tests pass.

## Phase 3 — city + media filters

1. create `FinderStore`,
2. derive cities from GeoJSON,
3. implement city selection,
4. derive available media from `faces`,
5. implement media filters,
6. bind map and results to filtered features.

Exit criteria:

- selected city changes result/map data,
- media filter evaluates all faces,
- no first-face-only bug,
- no manual refresh function.

## Phase 4 — prototype layout/results

1. migrate major CSS/layout from `/template`,
2. implement result cards,
3. map marker/result click synchronization,
4. desktop layout,
5. mobile layout.

Exit criteria:

- core screen resembles prototype,
- list and map represent same filtered sites,
- interactions are Angular bindings, not manual DOM wiring.

## Phase 5 — selection

1. implement deterministic panel selection keys,
2. add/select entire relevant site where appropriate,
3. support individual panel deselection,
4. selection dock,
5. selection drawer,
6. preserve selection while changing city/filter.

Exit criteria:

- exact selected panels are represented,
- counts are correct,
- selection does not disappear when browsing another city.

## Phase 6 — origin/radius

1. point origin signal,
2. radius control,
3. pure distance helper,
4. filter results by radius,
5. render origin/radius on Leaflet map if present in prototype.

Exit criteria:

- radius is derived state, not manually refreshed,
- map/list stay consistent.

## Phase 7 — remaining prototype features

Only after the core works, add the needed subset of:

- address search,
- POI search,
- route origin,
- polygon draw,
- sharing,
- CSV export,
- request dialog.

Implement these one at a time. Do not turn Phase 7 into another rewrite.

---

# 22. Practical code-quality rules for the Codex agent

## Prefer this

```ts
readonly filteredSites = computed(() => ...);
```

over this:

```ts
refreshSites(): void {
  this.filteredSites = ...;
  this.updateMap();
  this.updateList();
  this.updateCounts();
}
```

## Prefer this

```ts
readonly sites = this.sitesService.resource.value;
```

or:

```ts
readonly sites = this.sitesService.sites;
```

rather than converting HTTP into an Observable chain.

## Prefer this

```html
@for (site of store.filteredSites().features; track site.properties.sid) {
  <app-result-card [site]="site" />
}
```

rather than manual HTML strings.

## Prefer explicit handlers

```html
<button (click)="store.toggleMedia(media)">
```

rather than document-level listeners.

## Prefer feature-local Leaflet code

```text
site-map.component.ts
```

rather than a global map service full of mutable markers.

---

# 23. Things explicitly NOT to build

Unless a later requirement asks for them, do not add:

- Google Maps
- Google Places
- NgRx
- RxJS state store
- manual `.subscribe()` calls
- generic repository pattern
- generic ports/adapters architecture
- map provider abstraction
- SSR
- micro-frontends
- Tailwind
- Angular Material
- GraphQL
- Zod solely to validate this one endpoint
- runtime config framework
- Excel import in the public finder
- random demo data fallback
- marker clustering before measurement
- backend share service before URL sharing proves insufficient

---

# 24. Expected first-pass file tree

A good first implementation can stay this small:

```text
src/app/
  app.component.ts
  app.component.html
  app.component.css
  app.config.ts

  finder/
    finder-page.component.ts
    finder-page.component.html
    finder-page.component.css
    finder.store.ts
    finder.store.spec.ts

  sites/
    site-api.model.ts
    site-geojson.model.ts
    sites-to-geojson.ts
    sites-to-geojson.spec.ts
    sites.service.ts

  geo/
    distance.ts
    distance.spec.ts

  map/
    site-map.component.ts
    site-map.component.html
    site-map.component.css

  filters/
    media-filter.component.ts
    radius-filter.component.ts

  results/
    result-list.component.ts
    result-card.component.ts

  selection/
    selection-dock.component.ts
    selection-drawer.component.ts

  origin/
    origin-panel.component.ts

  request/
    request-dialog.component.ts
```

Do not create every file before it is needed. The tree is a target organization, not mandatory boilerplate.

---

# 25. Acceptance criteria

The first production-quality Angular rewrite is acceptable when:

1. It runs inside the already-created Angular 22+ project.
2. No `ng new` regeneration was performed.
3. `/template` remains reference material and is not the runtime implementation.
4. The app loads `https://standortfinder.wall.de/api/sites?year=2026` (or the same endpoint through a dev proxy).
5. API JSON is temporarily converted to GeoJSON in one isolated pure function/service boundary.
6. Sites with invalid coordinates are ignored safely.
7. `faces` remain available for media/price/panel behavior.
8. Leaflet is implemented with `@bluehalo/ngx-leaflet`.
9. The base map is open-source/open-data based; no Google Maps dependency exists.
10. Leaflet objects live in the map component, not the global store.
11. Angular Signals are the source of UI/application state.
12. Derived data uses `computed()`.
13. Read HTTP uses `httpResource()`.
14. `src/app` contains no manual `.subscribe()` calls.
15. No NgRx or other state library is present.
16. Media filtering checks all site faces.
17. Selection can identify individual panels deterministically.
18. List, marker set and counts stay consistent when filters change.
19. Request form uses Signal Forms if that feature is implemented.
20. Core unit tests pass.
21. `ng build` succeeds.
22. The UI follows the `/template` prototype closely without copying its DOM-rendering architecture.

---

# 26. Final implementation instruction to Codex

Work incrementally and keep the application runnable.

For each phase:

1. inspect the relevant prototype behavior,
2. implement the smallest Angular version,
3. run tests,
4. run `ng build`,
5. fix errors before moving on.

Do not spend time inventing architecture that the current application does not need.

The preferred mental model is:

```text
real API
  -> httpResource
  -> temporary sitesToGeoJson()
  -> Signals/computed FinderStore
  -> Angular templates
  -> ngx-leaflet map + result components
```

Not:

```text
API
  -> Observable service layer
  -> repository
  -> facade
  -> NgRx
  -> adapter hierarchy
  -> subscriptions
  -> imperative refresh
```

The code should be easy for another Angular developer to open and understand in one sitting.

---

# 27. Current reference documentation

- Angular `httpResource`: https://angular.dev/api/common/http/httpResource
- Angular HTTP resource guide: https://angular.dev/guide/http/http-resource
- Angular Signal Forms: https://angular.dev/guide/forms/signals/overview
- `@bluehalo/ngx-leaflet`: https://github.com/bluehalo/ngx-leaflet
- Leaflet: https://leafletjs.com/
- API: https://standortfinder.wall.de/api/sites?year=2026
