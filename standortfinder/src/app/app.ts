import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FinderPageComponent } from './finder/finder-page.component';

@Component({
  selector: 'app-root',
  imports: [FinderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
