import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Tickets Layout Component
 *
 * Simple pass-through layout that just renders the child route.
 * The main navigation is handled by the main-layout sidebar.
 */
@Component({
  selector: 'app-tickets-layout',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
  styles: [`:host { display: block; }`],
})
export class TicketsLayoutComponent {}
