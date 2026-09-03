import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { SiteIdentifier } from '../sites/site-api.model';
import { FinderStore, panelsForSite } from '../finder/finder.store';

@Component({
  selector: 'app-selection-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.drawerOpen()) {
      <button type="button" class="backdrop" aria-label="Auswahl schließen" (click)="store.closeDrawer()"></button>
    }
    <aside class="drawer" [class.open]="store.drawerOpen()" [attr.aria-hidden]="!store.drawerOpen()">
      <header>
        <h2>Meine Auswahl</h2>
        <button type="button" class="icon-button" title="Auswahl leeren" aria-label="Auswahl leeren" (click)="store.clearSelection()">⌫</button>
        <button type="button" class="icon-button" aria-label="Schließen" (click)="store.closeDrawer()">×</button>
      </header>
      <div class="drawer-body">
        @for (entry of store.selectedEntries(); track entry.feature.properties.sid) {
          @if (showCityHeading($index)) {
            <h3>{{ entry.feature.properties.city }}</h3>
          }
          <article>
            <div class="entry-head">
              <button type="button" class="expand" [attr.aria-expanded]="isExpanded(entry.feature.properties.sid)" (click)="toggleExpanded(entry.feature.properties.sid)">›</button>
              <div>
                <strong>{{ entry.feature.properties.siteDescription || 'Werbefläche' }}</strong>
                <small>Standort {{ entry.feature.properties.sid }} · {{ entry.panels.length }} {{ entry.panels.length === 1 ? 'Fläche' : 'Flächen' }}</small>
              </div>
              <button type="button" class="icon-button" aria-label="Standort entfernen" (click)="store.removeSite(entry.feature)">×</button>
            </div>
            @if (isExpanded(entry.feature.properties.sid)) {
              <div class="panels">
                @for (panel of panelsForSite(entry.feature); track panel.key) {
                  <label>
                    <input type="checkbox" [checked]="store.selection().has(panel.key)" (change)="store.togglePanel(panel.key)" />
                    <span>Fläche {{ panel.panel }} · {{ panel.mediaName }}</span>
                    @if (panel.face?.price != null) { <em>{{ formatPrice(panel.face?.price) }}</em> }
                  </label>
                }
              </div>
            }
          </article>
        } @empty {
          <p class="empty">Noch nichts ausgewählt.</p>
        }
      </div>
      <footer>
        <div class="actions">
          <button type="button" class="secondary" [disabled]="store.selectedPanelCount() === 0" (click)="openShare()">Teilen</button>
          <button type="button" class="secondary" [disabled]="store.selectedPanelCount() === 0" (click)="exportCsv()">Export</button>
        </div>
        <button type="button" class="request" [disabled]="store.selectedPanelCount() === 0" (click)="store.openRequestDialog()">Angebot anfragen</button>
      </footer>
    </aside>

    @if (shareOpen()) {
      <div class="modal-backdrop" role="presentation" (click)="shareOpen.set(false)">
        <section class="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" (click)="$event.stopPropagation()">
          <h2 id="share-title">Teilen</h2>
          <p>Der Link enthält die aktuell ausgewählten Flächen und Filter.</p>
          <div class="share-row">
            <input [value]="shareUrl()" readonly aria-label="Link zur Auswahl" />
            <button type="button" class="request" (click)="copyShareUrl()">{{ copyLabel() }}</button>
          </div>
          <button type="button" class="secondary close-dialog" (click)="shareOpen.set(false)">Schließen</button>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 1040; background: rgba(0,0,0,.18); }
    .drawer { position: absolute; top: 0; right: 0; bottom: 0; z-index: 1100; width: 410px; display: flex; flex-direction: column; transform: translateX(100%); background: var(--bg); border-left: 1px solid var(--gray-b); box-shadow: var(--shadow-lg); transition: transform .24s ease; }
    .drawer.open { transform: none; }
    header { display: flex; align-items: center; gap: 8px; padding: 18px; border-bottom: 1px solid var(--gray-b); }
    h2 { flex: 1; margin: 0; font-size: var(--t-body); }
    .icon-button { padding: 6px; color: var(--ink-30); font-size: 21px; }
    .drawer-body { flex: 1; overflow-y: auto; padding: 8px 18px; }
    h3 { display: flex; margin: 18px 0 0; padding-bottom: 6px; border-bottom: 1px solid var(--ink); font-size: var(--t-body); }
    h3:first-child { margin-top: 6px; }
    article { padding: 14px 0; border-bottom: 1px solid var(--gray-a); }
    .entry-head { display: flex; align-items: flex-start; gap: 8px; }
    .entry-head div { flex: 1; min-width: 0; }
    .entry-head strong, .entry-head small { display: block; }
    .entry-head strong { font-size: var(--t-sm); }
    .entry-head small { margin-top: 2px; color: var(--ink-30); font-size: var(--t-xs); }
    .expand { transform: rotate(0); padding: 0 4px; color: var(--ink-30); font-size: 22px; line-height: 1; transition: transform .15s; }
    .expand[aria-expanded="true"] { transform: rotate(90deg); }
    .panels { margin: 8px 0 0 27px; }
    .panels label { display: flex; align-items: center; gap: 7px; padding: 5px 0; color: var(--ink-30); font-size: var(--t-xs); }
    .panels input { accent-color: var(--ink); }
    .panels span { flex: 1; }
    .panels em { color: var(--text); font-style: normal; font-weight: 700; }
    .empty { padding: 40px 20px; text-align: center; color: var(--ink-30); }
    footer { padding: 16px 18px; border-top: 1px solid var(--gray-b); }
    .actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .actions button { flex: 1; }
    .secondary, .request { padding: 10px 14px; border: 1px solid var(--ink); font-size: var(--t-sm); font-weight: 700; }
    .request { width: 100%; background: var(--yellow); border-color: var(--yellow); }
    button[disabled] { opacity: .4; cursor: not-allowed; }
    .modal-backdrop { position: fixed; inset: 0; z-index: 1500; display: grid; place-items: center; padding: 24px; background: rgba(24,24,24,.42); }
    .share-dialog { width: min(580px, 100%); padding: 24px; background: #fff; box-shadow: var(--shadow-lg); }
    .share-dialog h2 { font-size: 24px; }
    .share-dialog p { color: var(--ink-30); }
    .share-row { display: flex; gap: 8px; margin-top: 16px; }
    .share-row input { flex: 1; min-width: 0; padding: 10px; border: 1px solid var(--gray-b); background: var(--gray-a); }
    .share-row .request { width: auto; }
    .close-dialog { margin-top: 18px; }
    @media (max-width: 759px) { .drawer { width: 100%; } .modal-backdrop { padding: 0; } .share-dialog { align-self: end; } }
  `,
})
export class SelectionDrawerComponent {
  protected readonly store = inject(FinderStore);
  protected readonly panelsForSite = panelsForSite;
  protected readonly expanded = signal<ReadonlySet<SiteIdentifier>>(new Set());
  protected readonly shareOpen = signal(false);
  protected readonly shareUrl = signal('');
  protected readonly copyLabel = signal('Kopieren');

  protected isExpanded(sid: SiteIdentifier): boolean {
    return this.expanded().has(sid);
  }

  protected toggleExpanded(sid: SiteIdentifier): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  }

  protected showCityHeading(index: number): boolean {
    const entries = this.store.selectedEntries();
    return entries.length > 1 &&
      (index === 0 || entries[index - 1].feature.properties.city !== entries[index].feature.properties.city);
  }

  protected formatPrice(price: number | null | undefined): string {
    return typeof price === 'number'
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price)
      : '';
  }

  protected openShare(): void {
    this.shareUrl.set(this.store.shareUrl());
    this.copyLabel.set('Kopieren');
    this.shareOpen.set(true);
  }

  protected async copyShareUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      location.hash = this.shareUrl().split('#')[1] ?? '';
      this.copyLabel.set('Kopiert');
    } catch {
      this.copyLabel.set('Bitte Link markieren');
    }
  }

  protected exportCsv(): void {
    const columns = [
      'Standort Nr.', 'QID', 'PPS', 'Jeweiliger Standort', 'Stadt',
      'Werbeträger', 'Wirkungsrichtung', 'Flächennummer', 'Anzahl Flächen',
      'Preis pro Tag', 'Längengrad', 'Breitengrad',
    ];
    const rows = [columns];
    for (const panel of this.store.selectedPanels()) {
      const properties = panel.feature.properties;
      const [longitude, latitude] = panel.feature.geometry.coordinates;
      rows.push([
        String(properties.sid), String(panel.face?.qid ?? ''), String(panel.face?.pps ?? ''),
        properties.siteDescription, properties.city, panel.mediaName,
        String(panel.face?.direction ?? ''), String(panel.panel), '1',
        panel.face?.price == null ? '' : String(panel.face.price).replace('.', ','),
        String(longitude), String(latitude),
      ]);
    }
    const csv = rows
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `standortauswahl-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
