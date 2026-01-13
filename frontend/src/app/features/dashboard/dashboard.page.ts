import { Component, ChangeDetectionStrategy, computed, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TicketService, TicketListItem } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    NzCardModule,
    NzStatisticModule,
    NzGridModule,
    NzIconModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly tickets = signal<TicketListItem[]>([]);

  // ========================================
  // TICKET STATISTICS
  // ========================================

  /** Total number of tickets */
  readonly totalTickets = computed(() => this.tickets().length);

  /** Count of tickets for review */
  readonly forReviewCount = computed(() =>
    this.tickets().filter((t) => t.status === 'FOR_REVIEW').length
  );

  /** Count of reviewed tickets */
  readonly reviewedCount = computed(() =>
    this.tickets().filter((t) => t.status === 'REVIEWED').length
  );

  /** Count of assigned tickets */
  readonly assignedCount = computed(() =>
    this.tickets().filter((t) => t.status === 'ASSIGNED').length
  );

  /** Count of in progress tickets */
  readonly inProgressCount = computed(() =>
    this.tickets().filter((t) => t.status === 'IN_PROGRESS').length
  );

  /** Count of on hold tickets */
  readonly onHoldCount = computed(() =>
    this.tickets().filter((t) => t.status === 'ON_HOLD').length
  );

  /** Count of resolved tickets */
  readonly resolvedCount = computed(() =>
    this.tickets().filter((t) => t.status === 'RESOLVED').length
  );

  /** Count of closed tickets */
  readonly closedCount = computed(() =>
    this.tickets().filter((t) => t.status === 'CLOSED').length
  );

  /** Count of cancelled tickets */
  readonly cancelledCount = computed(() =>
    this.tickets().filter((t) => t.status === 'CANCELLED').length
  );

  /** Count of ongoing tickets (FOR_REVIEW + REVIEWED + ASSIGNED + IN_PROGRESS + ON_HOLD) */
  readonly ongoingCount = computed(() =>
    this.forReviewCount() +
    this.reviewedCount() +
    this.assignedCount() +
    this.inProgressCount() +
    this.onHoldCount()
  );

  /** Recent tickets (last 10) sorted by creation date */
  readonly recentTickets = computed(() =>
    [...this.tickets()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  );

  ngOnInit(): void {
    this.loadTickets();

    // Set up auto-refresh polling every 60 seconds (1 minute)
    interval(60000) // 60000ms = 1 minute
      .pipe(
        switchMap(() => this.getTicketQuery()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (tickets) => {
          // Silently update tickets without showing loading spinner
          this.tickets.set(tickets);
        },
        error: (error) => {
          console.error('Auto-refresh failed:', error);
        },
      });
  }

  /**
   * Get ticket query based on user role
   * Backend handles role-specific filtering for Office Heads
   */
  private getTicketQuery() {
    if (this.authService.isAdmin() || this.authService.isSecretary()) {
      // Admin/Secretary sees all tickets
      return this.ticketService.getAllTickets();
    } else if (this.authService.isOfficeHead() || this.authService.isDeveloper() || this.authService.isTechnical()) {
      // Office heads see tickets of their type, developers/technical see their assigned tickets
      // Backend myTickets resolver handles the role-specific logic
      return this.ticketService.getMyAssignedTickets();
    } else {
      // Regular users see tickets they created
      return this.ticketService.getMyCreatedTickets();
    }
  }

  /**
   * Load all tickets for statistics
   */
  loadTickets(): void {
    this.loading.set(true);

    this.getTicketQuery().subscribe({
      next: (tickets) => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tickets:', error);
        this.loading.set(false);
      },
    });
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      FOR_REVIEW: 'gold',
      REVIEWED: 'blue',
      DIRECTOR_APPROVED: 'cyan',
      ASSIGNED: 'purple',
      IN_PROGRESS: 'processing',
      ON_HOLD: 'warning',
      RESOLVED: 'success',
      CLOSED: 'default',
      CANCELLED: 'error',
    };
    return colorMap[status] || 'default';
  }

  getPriorityColor(priority: string): string {
    const colorMap: Record<string, string> = {
      LOW: 'default',
      MEDIUM: 'blue',
      HIGH: 'orange',
      CRITICAL: 'red',
    };
    return colorMap[priority] || 'default';
  }
}
