import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FinderStore } from '../finder/finder.store';

@Component({
  selector: 'app-selection-dock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.visible]': 'store.selectedPanelCount() > 0' },
  template: `
    <span class="count" aria-live="polite">
      <strong>{{ store.selectedSiteCount() }}</strong>
      {{ store.selectedSiteCount() === 1 ? 'Standort' : 'Standorte' }}
      <span>·</span>
      <strong>{{ store.selectedPanelCount() }}</strong>
      {{ store.selectedPanelCount() === 1 ? 'Fläche' : 'Flächen' }}
    </span>
    <button type="button" class="secondary" (click)="store.openDrawer()">
      Meine Auswahl
    </button>
    <button type="button" class="request" (click)="store.openRequestDialog()">
      Angebot anfragen
    </button>
  `,
  styles: `
    :host { position: absolute; left: 50%; bottom: 16px; z-index: 850; display: flex; align-items: center; gap: 14px; padding: 12px 14px 12px 20px; transform: translateX(-50%) translateY(12px); opacity: 0; pointer-events: none; background: linear-gradient(160deg,#1474d3,#42007e); color: #fff; box-shadow: var(--shadow-lg); transition: opacity .2s, transform .2s; }
    :host.visible { transform: translateX(-50%); opacity: 1; pointer-events: auto; }
    .count { white-space: nowrap; font-size: var(--t-sm); }
    .count span { color: rgba(255,255,255,.72); }
    button { padding: 9px 12px; border: 1px solid rgba(255,255,255,.3); color: #fff; font-size: var(--t-sm); }
    button:hover, .request { background: var(--yellow); border-color: var(--yellow); color: #000; }
    @media (max-width: 759px) {
      :host { left: 8px; right: 8px; bottom: calc(48dvh + 8px); transform: translateY(12px); padding: 9px 10px; gap: 8px; }
      :host.visible { transform: none; }
      .count { flex: 1; font-size: var(--t-xs); }
      .secondary { display: none; }
      button { padding: 8px 10px; }
    }
  `,
})
export class SelectionDockComponent {
  protected readonly store = inject(FinderStore);
}
