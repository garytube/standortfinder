import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FinderStore } from '../finder/finder.store';

@Component({
  selector: 'app-radius-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.origin()) {
      <details class="radius-menu">
        <summary class="chip accent">Umkreis {{ radiusLabel() }}</summary>
        <div class="radius-popover">
          <label for="radius">
            Umkreis
            <output>{{ radiusLabel() }}</output>
          </label>
          <input
            id="radius"
            type="range"
            min="100"
            max="5000"
            step="100"
            [value]="store.radiusMeters()"
            (input)="updateRadius($event)"
          />
          <button type="button" class="text-button" (click)="store.setOrigin(null)">
            Eingrenzung aufheben
          </button>
        </div>
      </details>
    }
  `,
  styles: `
    :host { display: contents; }
    .radius-menu { position: relative; }
    summary { list-style: none; }
    summary::-webkit-details-marker { display: none; }
    .radius-popover {
      position: absolute; top: calc(100% + 14px); left: 0; width: 280px;
      padding: 16px; background: var(--bg); border: 1px solid var(--gray-b);
      box-shadow: var(--shadow-lg); z-index: 1200;
    }
    label { display: flex; justify-content: space-between; font-size: var(--t-sm); font-weight: 700; }
    input { width: 100%; margin: 16px 0; accent-color: var(--blue); }
    output { font-variant-numeric: tabular-nums; }
    .text-button { font-size: var(--t-xs); text-decoration: underline; color: var(--ink-30); }
  `,
})
export class RadiusFilterComponent {
  protected readonly store = inject(FinderStore);

  protected radiusLabel(): string {
    const radius = this.store.radiusMeters();
    return radius >= 1_000
      ? `${(radius / 1_000).toFixed(1).replace('.', ',')} km`
      : `${radius} m`;
  }

  protected updateRadius(event: Event): void {
    this.store.setRadius(Number((event.target as HTMLInputElement).value));
  }
}
