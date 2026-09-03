import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FinderStore } from '../finder/finder.store';

@Component({
  selector: 'app-media-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="filter-menu">
      <summary
        class="chip"
        [class.accent]="store.activeMedia().size > 0"
        aria-label="Werbeträger filtern"
      >
        <strong>Werbeträger</strong>
        <span>{{ store.activeMedia().size ? store.activeMedia().size + ' aktiv' : 'Alle' }}</span>
      </summary>
      <div class="filter-popover">
        <div class="filter-heading">
          <div>
            <strong>Werbeträger</strong>
            <small>Mindestens ein passendes Format pro Standort</small>
          </div>
          <button type="button" class="text-button" (click)="store.clearMediaFilter()">
            Alle
          </button>
        </div>
        @for (media of store.availableMedia(); track media) {
          <label class="media-row">
            <input
              type="checkbox"
              [checked]="store.isMediaActive(media)"
              (change)="store.toggleMedia(media)"
            />
            <span class="media-icon" aria-hidden="true"></span>
            <span>{{ media }}</span>
          </label>
        }
      </div>
    </details>
  `,
  styles: `
    :host { display: contents; }
    .filter-menu { position: relative; }
    summary { list-style: none; }
    summary::-webkit-details-marker { display: none; }
    .filter-popover {
      position: absolute; top: calc(100% + 14px); left: 0; width: 320px;
      max-height: min(480px, calc(100dvh - 100px)); overflow: auto;
      padding: 16px; background: var(--bg); border: 1px solid var(--gray-b);
      box-shadow: var(--shadow-lg); z-index: 1200;
    }
    .filter-heading { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .filter-heading strong, .filter-heading small { display: block; }
    .filter-heading small { color: var(--ink-30); font-size: var(--t-xs); margin-top: 2px; }
    .media-row { display: flex; align-items: center; gap: 10px; padding: 9px 8px; cursor: pointer; }
    .media-row:hover { background: var(--hover-bg); }
    .media-row input { width: 16px; height: 16px; accent-color: var(--ink); }
    .media-icon { width: 11px; height: 11px; border-radius: 50%; background: var(--blue); }
    .text-button { color: var(--ink-30); text-decoration: underline; font-size: var(--t-xs); }
    @media (max-width: 759px) { .filter-popover { position: fixed; top: 68px; left: 8px; right: 8px; width: auto; } }
  `,
})
export class MediaFilterComponent {
  protected readonly store = inject(FinderStore);
}
