import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RouteProgress } from './layout/route-progress';
import { NavigationUxService } from './core/services/navigation-ux.service';

@Component({
  imports: [RouterOutlet, RouteProgress],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly navUx = inject(NavigationUxService);

  ngOnInit(): void {
    this.navUx.start();
  }
}
