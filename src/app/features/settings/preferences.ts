import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PreferencesService } from '../../core/services/preferences.service';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-preferences',
  imports: [PageHeader, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './preferences.html',
  styleUrl: './preferences.scss',
})
export class PreferencesPage {
  readonly prefs = inject(PreferencesService);
}
