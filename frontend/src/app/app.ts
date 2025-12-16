import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  readonly authService = inject(AuthService);

  constructor() {
    console.log('[APP] 🏠 App component constructor');
    console.log('[APP] initialized:', this.authService.initialized(), 'isAuthenticated:', this.authService.isAuthenticated());
  }

  ngOnInit(): void {
    console.log('[APP] 🏠 App component ngOnInit');
    console.log('[APP] initialized:', this.authService.initialized(), 'isAuthenticated:', this.authService.isAuthenticated());
  }
}
