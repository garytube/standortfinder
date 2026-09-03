import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FinderStore } from '../finder/finder.store';
import { ResultCardComponent } from './result-card.component';

@Component({
  selector: 'app-result-list',
  imports: [ResultCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="results" aria-label="Suchergebnisse">
      <div class="sheet-grip" aria-hidden="true"></div>
      <header>
        <h2 aria-live="polite">
          {{ store.resultCount() }}
          {{ store.resultCount() === 1 ? 'Standort' : 'Standorte' }}
          @if (store.selectedCity()) { in {{ store.selectedCity() }} }
        </h2>
        @if (store.resultCount() > 1) {
          <button type="button" class="small-button" (click)="store.selectAllFiltered()">
            Alle hinzufügen
          </button>
        }
      </header>
      @if (otherCityCount() > 0) {
        <p class="other-cities">
          {{ otherCityCount() }} ausgewählte
          {{ otherCityCount() === 1 ? 'Standort liegt' : 'Standorte liegen' }} in anderen Städten.
          <button type="button" (click)="store.openDrawer()">Ansehen</button>
        </p>
      }
      <div class="result-list">
        @for (site of store.filteredFeatures().slice(0, 200); track site.properties.sid) {
          <app-result-card [site]="site" />
        } @empty {
          <div class="empty">
            @if (store.origin()) {
              In diesem Umkreis liegen keine Werbeflächen.
            } @else {
              Keine Werbeflächen für diese Auswahl.
            }
          </div>
        }
        @if (store.resultCount() > 200) {
          <p class="list-note">
            Es werden 200 von {{ store.resultCount() }} Standorten angezeigt.
            Grenzen Sie die Suche ein, um alle zu sehen.
          </p>
        }
      </div>
      <footer>
        <a href="https://www.walldecaux.de/impressum" target="_blank" rel="noopener">Impressum</a>
        <a href="https://www.walldecaux.de/datenschutz" target="_blank" rel="noopener">Datenschutz</a>
      </footer>
    </aside>
  `,
  styles: `
    :host { display: contents; }
    .results { position: absolute; top: var(--panel-top); right: 16px; bottom: calc(var(--dock-h) + 16px); z-index: 800; width: 340px; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); border: 1px solid var(--gray-b); box-shadow: var(--shadow); }
    header { display: flex; align-items: center; gap: 10px; padding: 15px 16px 13px; border-bottom: 1px solid var(--gray-b); }
    h2 { flex: 1; margin: 0; font-size: var(--t-body); }
    .small-button { padding: 6px 10px; border: 1px solid var(--gray-b); font-size: var(--t-xs); font-weight: 700; }
    .small-button:hover { background: var(--hover-bg); }
    .result-list { flex: 1; overflow-y: auto; padding: 8px; }
    .other-cities { margin: 0; padding: 9px 16px; background: var(--blue-soft); border-bottom: 1px solid var(--gray-b); font-size: var(--t-xs); }
    .other-cities button { text-decoration: underline; }
    .empty { padding: 40px 24px; text-align: center; color: var(--ink-30); font-size: var(--t-sm); }
    .list-note { margin: 6px 11px 14px; padding: 11px 12px; background: var(--gray-a); color: var(--ink-30); font-size: var(--t-xs); }
    footer { display: none; padding: 14px 16px; border-top: 1px solid var(--gray-b); }
    footer a { margin-right: 16px; color: var(--ink-30); font-size: var(--t-xs); }
    .sheet-grip { display: none; }
    @media (max-width: 1099px) { .results { width: 310px; } }
    @media (max-width: 759px) {
      .results { --peek: 132px; top: auto; left: 0; right: 0; bottom: 0; width: auto; height: 48dvh; border-width: 1px 0 0; box-shadow: 0 -6px 28px rgba(24,24,24,.2); }
      .sheet-grip { display: block; width: 38px; height: 4px; margin: 9px auto 3px; background: var(--gray-b); border-radius: 4px; }
      header { padding-top: 8px; }
      footer { display: block; }
    }
  `,
})
export class ResultListComponent {
  protected readonly store = inject(FinderStore);

  protected otherCityCount(): number {
    const city = this.store.selectedCity();
    return this.store.selectedEntries().filter(
      (entry) => entry.feature.properties.city !== city,
    ).length;
  }
}
