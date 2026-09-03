import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MediaFilterComponent } from '../filters/media-filter.component';
import { RadiusFilterComponent } from '../filters/radius-filter.component';
import { SiteMapComponent } from '../map/site-map.component';
import { OriginPanelComponent } from '../origin/origin-panel.component';
import { RequestDialogComponent } from '../request/request-dialog.component';
import { ResultListComponent } from '../results/result-list.component';
import { SelectionDockComponent } from '../selection/selection-dock.component';
import { SelectionDrawerComponent } from '../selection/selection-drawer.component';
import { FinderStore } from './finder.store';

@Component({
  selector: 'app-finder-page',
  imports: [
    MediaFilterComponent,
    OriginPanelComponent,
    RadiusFilterComponent,
    RequestDialogComponent,
    ResultListComponent,
    SelectionDockComponent,
    SelectionDrawerComponent,
    SiteMapComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finder-page.component.html',
  styleUrl: './finder-page.component.css',
})
export class FinderPageComponent {
  protected readonly store = inject(FinderStore);

  protected selectCity(event: Event): void {
    const city = (event.target as HTMLSelectElement).value;
    this.store.selectCity(city || null);
  }

  protected resetView(): void {
    this.store.selectCity(null);
    this.store.originPanelOpen.set(false);
  }
}
