import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-about',
  imports: [PageHeader, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutPage {
  readonly year = new Date().getFullYear();
}
