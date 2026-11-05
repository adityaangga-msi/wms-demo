import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'app-scenarios',
  imports: [PageHeader, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './scenarios.html',
  styleUrl: './scenarios.scss',
})
export class ScenariosPage {}
