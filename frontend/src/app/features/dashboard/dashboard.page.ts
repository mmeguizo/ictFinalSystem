import { Component, ChangeDetectionStrategy, computed, inject, OnInit, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
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
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
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
    NzModalModule,
    NzAlertModule,
    NzProgressModule,
    NzDividerModule,
    NzButtonModule,
    NzToolTipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(false);
  readonly tickets = signal<TicketListItem[]>([]);

  // SLA Reminder Modal
  readonly showSlaModal = signal(false);
  readonly showSlaBanner = signal(true);

  /** SLA processing steps for display */
  readonly slaSteps = [
    { step: 1, name: 'Secretary Review', description: 'Secretary endorses and reviews the service request', expectedMinutes: 5, icon: '📋' },
    { step: 2, name: 'Director Endorsement', description: 'Director reviews and approves the request', expectedMinutes: 5, icon: '✅' },
    { step: 3, name: 'Assignment', description: 'Request is assigned to the appropriate department', expectedMinutes: 5, icon: '👤' },
    { step: 4, name: 'Schedule Visit', description: 'Department head schedules a service visit', expectedMinutes: 5, icon: '📅' },
    { step: 5, name: 'Acknowledgment', description: 'Admin acknowledges the schedule for service delivery', expectedMinutes: 5, icon: '🤝' },
  ];

  readonly totalSlaMinutes = 25;

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
    this.checkSlaReminderOnLogin();

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
  // SLA REMINDER
  // ========================================

  /** Check if we should show the SLA reminder modal (once per session) */
  private checkSlaReminderOnLogin(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const key = 'sla_reminder_shown';
    const shown = sessionStorage.getItem(key);
    if (!shown) {
      // Show the modal after a short delay so dashboard loads first
      setTimeout(() => {
        this.showSlaModal.set(true);
        sessionStorage.setItem(key, 'true');
      }, 800);
    }
  }

  /** Close the SLA modal */
  closeSlaModal(): void {
    this.showSlaModal.set(false);
  }

  /** Dismiss the SLA banner */
  dismissSlaBanner(): void {
    this.showSlaBanner.set(false);
  }

  /** Open the SLA modal (from banner "Learn More" button) */
  openSlaModal(): void {
    this.showSlaModal.set(true);
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
