import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { FormsModule } from '@angular/forms';
import { TicketService, TicketListItem } from '../../core/services/ticket.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth.service';

/**
 * My Tickets Page
 *
 * Role-based views:
 * - USER: Shows tickets they created
 * - MIS_HEAD/ITS_HEAD: Shows tickets assigned to their department, can assign to staff
 * - DEVELOPER/TECHNICAL: Shows tickets assigned to them, can update status
 * - ADMIN: Shows all tickets
 * - SECRETARY: Shows all tickets (for oversight)
 */
@Component({
  selector: 'app-my-tickets',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    NzTableModule,
    NzCardModule,
    NzTagModule,
    NzButtonModule,
    NzSpinModule,
    NzEmptyModule,
    NzSelectModule,
    NzModalModule,
    NzInputModule,
    NzPopconfirmModule,
    NzToolTipModule,
    NzDatePickerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tickets.page.html',
  styleUrls: ['./my-tickets.page.scss'],
})
export class MyTicketsPage implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly message = inject(NzMessageService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly tickets = signal<TicketListItem[]>([]);
  readonly statusFilter = signal<string>('ALL');

  // Staff list for assignment dropdown (populated for MIS_HEAD/ITS_HEAD)
  readonly staffList = signal<{ id: number; name: string; email: string; role: string }[]>([]);

  // Modal state for assignment
  readonly showAssignModal = signal(false);
  readonly selectedTicketId = signal<number | null>(null);
  readonly selectedUserId = signal<number | null>(null);

  // Modal state for status update
  readonly showStatusModal = signal(false);
  readonly selectedStatus = signal<string>('');
  readonly statusComment = signal<string>('');

  // Modal state for secretary review (for Admin)
  readonly showReviewModal = signal(false);
  readonly reviewTicketId = signal<number | null>(null);
  readonly reviewComment = signal<string>('');
  readonly reviewAction = signal<'approve' | 'reject'>('approve');

  // Modal state for schedule visit (for Department Heads)
  readonly showScheduleModal = signal(false);
  readonly scheduleTicketId = signal<number | null>(null);
  readonly dateToVisit = signal<Date | null>(null);
  readonly targetCompletionDate = signal<Date | null>(null);
  readonly scheduleComment = signal<string>('');

  // Modal state for acknowledge schedule (for Admin)
  readonly showAcknowledgeModal = signal(false);
  readonly acknowledgeTicketId = signal<number | null>(null);
  readonly acknowledgeComment = signal<string>('');
  readonly acknowledgeAction = signal<'acknowledge' | 'reject'>('acknowledge');
  readonly rejectReason = signal<string>('');

  // Modal state for monitor notes (for Department Heads)
  readonly showMonitorModal = signal(false);
  readonly monitorTicketId = signal<number | null>(null);
  readonly monitorNotes = signal<string>('');
  readonly recommendations = signal<string>('');
  readonly monitorComment = signal<string>('');

  // ========================================
  // ROLE CHECKS
  // ========================================

  /** Check if user is MIS Head */
  readonly isMISHead = computed(() => this.authService.isMISHead());

  /** Check if user is ITS Head */
  readonly isITSHead = computed(() => this.authService.isITSHead());

  /** Check if user is a department head (MIS or ITS) */
  readonly isDepartmentHead = computed(() => this.authService.isOfficeHead());

  /** Check if user is staff (Developer or Technical) */
  readonly isStaff = computed(
    () => this.authService.isDeveloper() || this.authService.isTechnical()
  );

  /** Check if user is admin */
  readonly isAdmin = computed(() => this.authService.isAdmin());

  /** Check if user is secretary */
  readonly isSecretary = computed(() => this.authService.isSecretary());

  /** Check if user can review as secretary (admin or secretary) */
  readonly canReviewAsSecretary = computed(
    () => this.authService.isAdmin() || this.authService.isSecretary()
  );

  /** Check if user can view all tickets (admin, heads, secretary) */
  readonly canViewAllTickets = computed(
    () =>
      this.authService.isAdmin() ||
      this.authService.isOfficeHead() ||
      this.authService.isSecretary()
  );

  /** Check if user can create tickets (USER and SECRETARY roles) */
  readonly canCreateTicket = computed(
    () => this.authService.isSecretary() || this.authService.isUser()
  );

  /** Check if user can assign tickets (department heads only) */
  readonly canAssignTickets = computed(() => this.isDepartmentHead());

  /** Check if user can update ticket status (staff members) */
  readonly canUpdateStatus = computed(() => this.isStaff());

  // ========================================
  // DYNAMIC PAGE CONTENT
  // ========================================

  /** Dynamic page title based on role */
  readonly pageTitle = computed(() => {
    if (this.isAdmin()) return 'All Tickets';
    if (this.isDepartmentHead()) return 'Tickets to Assign';
    if (this.isStaff()) return 'My Work Queue';
    return 'My Tickets';
  });

  /** Dynamic page subtitle */
  readonly pageSubtitle = computed(() => {
    if (this.isDepartmentHead()) return 'Assign tickets to your team members';
    if (this.isStaff()) return 'View and work on your assigned tickets';
    return 'View status of your submitted tickets';
  });

  /** Status options available for staff to update */
  readonly statusOptions = [
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'ON_HOLD', label: 'On Hold' },
    { value: 'RESOLVED', label: 'Resolved' },
  ];

  readonly filteredTickets = computed(() => {
    const filter = this.statusFilter();
    const allTickets = this.tickets();

    if (filter === 'ALL') {
      return allTickets;
    }

    return allTickets.filter((t) => t.status === filter);
  });

  // ========================================
  // TICKET STATISTICS
  // ========================================

  /** Total number of tickets */
  readonly totalTickets = computed(() => this.tickets().length);

  /** Count of tickets for review */
  readonly forReviewCount = computed(
    () => this.tickets().filter((t) => t.status === 'FOR_REVIEW').length
  );

  /** Count of reviewed tickets */
  readonly reviewedCount = computed(
    () => this.tickets().filter((t) => t.status === 'REVIEWED').length
  );

  /** Count of director approved tickets */
  readonly directorApprovedCount = computed(
    () => this.tickets().filter((t) => t.status === 'DIRECTOR_APPROVED').length
  );

  /** Count of assigned tickets */
  readonly assignedCount = computed(
    () => this.tickets().filter((t) => t.status === 'ASSIGNED').length
  );

  /** Count of pending acknowledgment tickets */
  readonly pendingAcknowledgmentCount = computed(
    () => this.tickets().filter((t) => t.status === 'PENDING_ACKNOWLEDGMENT').length
  );

  /** Count of scheduled tickets */
  readonly scheduledCount = computed(
    () => this.tickets().filter((t) => t.status === 'SCHEDULED').length
  );

  /** Count of in progress tickets */
  readonly inProgressCount = computed(
    () => this.tickets().filter((t) => t.status === 'IN_PROGRESS').length
  );

  /** Count of on hold tickets */
  readonly onHoldCount = computed(
    () => this.tickets().filter((t) => t.status === 'ON_HOLD').length
  );

  /** Count of resolved tickets */
  readonly resolvedCount = computed(
    () => this.tickets().filter((t) => t.status === 'RESOLVED').length
  );

  /** Count of closed tickets */
  readonly closedCount = computed(() => this.tickets().filter((t) => t.status === 'CLOSED').length);

  /** Count of cancelled tickets */
  readonly cancelledCount = computed(
    () => this.tickets().filter((t) => t.status === 'CANCELLED').length
  );

  /** Recent tickets (last 10) sorted by creation date */
  readonly recentTickets = computed(() =>
    [...this.tickets()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  );

  ngOnInit(): void {
    this.loadTickets();

    // Load staff list if user is a department head
    if (this.isDepartmentHead()) {
      this.loadStaffList();
    }

    // Set up auto-refresh polling every 60 seconds (1 minute)
    // Only poll when user is viewing the page
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
          // Don't show error message to avoid interrupting user
        },
      });
  }

  /**
   * Get ticket query based on user role (extracted for reuse in polling)
   */
  private getTicketQuery() {
    if (this.isAdmin() || this.authService.isSecretary()) {
      // Admin/Secretary sees all tickets
      return this.ticketService.getAllTickets();
    } else if (this.isDepartmentHead() || this.isStaff()) {
      // Department heads and staff see their assigned tickets
      return this.ticketService.getMyAssignedTickets();
    } else {
      // Regular users see tickets they created
      return this.ticketService.getMyCreatedTickets();
    }
  }

  /**
   * Load tickets based on user role
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
        this.message.error('Failed to load tickets');
        this.loading.set(false);
      },
    });
  }

  /**
   * Load staff list for assignment dropdown
   * MIS_HEAD sees DEVELOPERs, ITS_HEAD sees TECHNICAL staff
   */
  loadStaffList(): void {
    const role = this.isMISHead() ? 'DEVELOPER' : 'TECHNICAL';

    this.ticketService.getUsersByRole(role).subscribe({
      next: (users) => {
        this.staffList.set(users);
      },
      error: (error) => {
        console.error('Failed to load staff list:', error);
        this.message.error('Failed to load staff list');
      },
    });
  }

  // ========================================
  // ASSIGNMENT METHODS (for Department Heads)
  // ========================================

  /**
   * Open assignment modal for a ticket
   */
  openAssignModal(ticketId: number): void {
    this.selectedTicketId.set(ticketId);
    this.selectedUserId.set(null);
    this.showAssignModal.set(true);
  }

  /**
   * Close assignment modal
   */
  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.selectedTicketId.set(null);
    this.selectedUserId.set(null);
  }

  /**
   * Assign ticket to selected staff member
   */
  confirmAssignment(): void {
    const ticketId = this.selectedTicketId();
    const userId = this.selectedUserId();

    if (!ticketId || !userId) {
      this.message.warning('Please select a staff member');
      return;
    }

    this.loading.set(true);
    this.ticketService.assignTicketToUser(ticketId, userId).subscribe({
      next: () => {
        this.message.success('Ticket assigned successfully!');
        this.closeAssignModal();
        this.loadTickets(); // Refresh list
      },
      error: (error) => {
        console.error('Failed to assign ticket:', error);
        this.message.error('Failed to assign ticket');
        this.loading.set(false);
      },
    });
  }

  // ========================================
  // STATUS UPDATE METHODS (for Staff)
  // ========================================

  /**
   * Open status update modal
   */
  openStatusModal(ticketId: number, currentStatus: string): void {
    this.selectedTicketId.set(ticketId);
    this.selectedStatus.set(currentStatus);
    this.statusComment.set('');
    this.showStatusModal.set(true);
  }

  /**
   * Close status update modal
   */
  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedTicketId.set(null);
    this.selectedStatus.set('');
    this.statusComment.set('');
  }

  /**
   * Update ticket status
   */
  confirmStatusUpdate(): void {
    const ticketId = this.selectedTicketId();
    const status = this.selectedStatus();

    if (!ticketId || !status) {
      this.message.warning('Please select a status');
      return;
    }

    this.loading.set(true);
    this.ticketService.updateStatus(ticketId, status, this.statusComment() || undefined).subscribe({
      next: () => {
        this.message.success('Status updated successfully!');
        this.closeStatusModal();
        this.loadTickets(); // Refresh list
      },
      error: (error) => {
        console.error('Failed to update status:', error);
        this.message.error('Failed to update status');
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
      PENDING_ACKNOWLEDGMENT: 'orange',
      SCHEDULED: 'geekblue',
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

  /**
   * Disable past dates in date picker
   */
  disablePastDates = (current: Date): boolean => {
    // Can not select days before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return current < today;
  };

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  }

  getAssignedStaff(ticket: TicketListItem): string {
    if (!ticket.assignments || ticket.assignments.length === 0) {
      return 'Unassigned';
    }
    return ticket.assignments.map((a) => a.user.name || a.user.email).join(', ');
  }

  /**
   * Check if a ticket can be assigned (ASSIGNED status, department head role)
   * Only show assign button if no staff (DEVELOPER/TECHNICAL) is already assigned
   */
  canAssign(ticket: TicketListItem): boolean {
    if (!this.isDepartmentHead()) return false;
    if (ticket.status !== 'ASSIGNED') return false;

    // Check if any staff (DEVELOPER or TECHNICAL) is already assigned
    const hasStaffAssigned = ticket.assignments?.some(
      (a) => a.user.role === 'DEVELOPER' || a.user.role === 'TECHNICAL'
    );

    // Can only assign if no staff is assigned yet
    return !hasStaffAssigned;
  }

  /**
   * Check if a ticket status can be updated (assigned to current user)
   */
  canUpdate(ticket: TicketListItem): boolean {
    if (!this.isStaff()) return false;
    const currentUserId = this.authService.currentUser()?.id;
    return ticket.assignments?.some((a) => a.user.id === currentUserId) ?? false;
  }

  /**
   * Check if ticket can be reviewed by secretary/admin
   */
  canReview(ticket: TicketListItem): boolean {
    return (
      this.canReviewAsSecretary() && ticket.status === 'FOR_REVIEW' && !ticket.secretaryReviewedAt
    );
  }

  canReviewAdmin(ticket: TicketListItem): boolean {
    return this.isAdmin() && ticket.status === 'REVIEWED' && !ticket.directorApprovedAt;
  }

  /**
   * Check if ticket can be scheduled by department head
   * (After assignment with staff, heads set visit date and target completion date)
   */
  canSchedule(ticket: TicketListItem): boolean {
    if (!this.isDepartmentHead()) return false;
    // Can schedule if ticket is ASSIGNED and has staff assigned but no schedule set yet
    if (ticket.status !== 'ASSIGNED') return false;

    // Check if staff is assigned
    const hasStaffAssigned = ticket.assignments?.some(
      (a) => a.user.role === 'DEVELOPER' || a.user.role === 'TECHNICAL'
    );

    // Can schedule if staff is assigned and no visit date set yet
    return hasStaffAssigned && !ticket.dateToVisit;
  }

  /**
   * Check if ticket can be acknowledged by admin
   * (Admin acknowledges the schedule set by department head)
   */
  canAcknowledge(ticket: TicketListItem): boolean {
    return this.isAdmin() && ticket.status === 'PENDING_ACKNOWLEDGMENT';
  }

  /**
   * Check if ticket can have monitor notes added by department head
   * (After visit - SCHEDULED, IN_PROGRESS, ON_HOLD, RESOLVED statuses)
   */
  canAddMonitor(ticket: TicketListItem): boolean {
    if (!this.isDepartmentHead()) return false;
    // Can add monitor notes on tickets that are scheduled or later, and don't have notes yet
    const allowedStatuses = ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'];
    return allowedStatuses.includes(ticket.status) && !ticket.monitorNotes;
  }

  // ========================================
  // SECRETARY REVIEW METHODS (for Admin)
  // ========================================

  /**
   * Open review modal
   */
  openReviewModal(ticketId: number): void {
    this.reviewTicketId.set(ticketId);
    this.reviewAction.set('approve');
    this.reviewComment.set('');
    this.showReviewModal.set(true);
  }

  /**
   * Close review modal
   */
  closeReviewModal(): void {
    this.showReviewModal.set(false);
    this.reviewTicketId.set(null);
    this.reviewComment.set('');
  }

  /**
   * Confirm secretary review (approve or reject with comment)
   */
  confirmReview(): void {
    const ticketId = this.reviewTicketId();
    const action = this.reviewAction();
    const comment = this.reviewComment().trim();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    if (action === 'reject' && !comment) {
      this.message.warning('Please provide a reason for returning the ticket');
      return;
    }

    this.loading.set(true);

    if (action === 'approve') {
      // Approve: Mark as reviewed

      if (this.isAdmin()) {
        this.ticketService.approveAsDirector(ticketId, comment || undefined).subscribe({
          next: () => {
            this.message.success('Ticket reviewed and forwarded for director approval!');
            this.closeReviewModal();
            this.loadTickets();
          },
          error: (err) => {
            console.error('Failed to review ticket:', err);
            this.message.error('Failed to review ticket');
            this.loading.set(false);
          },
        });
      }

      if (this.isSecretary()) {
        this.ticketService.reviewAsSecretary(ticketId, comment || undefined).subscribe({
          next: () => {
            this.message.success('Ticket reviewed and forwarded for director approval!');
            this.closeReviewModal();
            this.loadTickets();
          },
          error: (err) => {
            console.error('Failed to review ticket:', err);
            this.message.error('Failed to review ticket');
            this.loading.set(false);
          },
        });
      }
    } else {
      // Reject: Return to user with comment
      if (this.isAdmin()) {
        this.ticketService.disapproveAsDirector(ticketId, comment).subscribe({
          next: () => {
            this.message.success('Ticket returned to requester with comments');
            this.closeReviewModal();
            this.loadTickets();
          },
          error: (err) => {
            console.error('Failed to reject ticket:', err);
            this.message.error(err?.message || 'Failed to reject ticket');
            this.loading.set(false);
          },
        });
      }

      if (this.isSecretary()) {
        this.ticketService.rejectAsSecretary(ticketId, comment).subscribe({
          next: () => {
            this.message.success('Ticket returned to requester with comments');
            this.closeReviewModal();
            this.loadTickets();
          },
          error: (err) => {
            console.error('Failed to reject ticket:', err);
            this.message.error(err?.message || 'Failed to reject ticket');
            this.loading.set(false);
          },
        });
      }
    }
  }

  // ========================================
  // SCHEDULE VISIT METHODS (for Department Heads)
  // ========================================

  /**
   * Open schedule visit modal
   */
  openScheduleModal(ticketId: number): void {
    this.scheduleTicketId.set(ticketId);
    this.dateToVisit.set(null);
    this.targetCompletionDate.set(null);
    this.scheduleComment.set('');
    this.showScheduleModal.set(true);
  }

  /**
   * Close schedule visit modal
   */
  closeScheduleModal(): void {
    this.showScheduleModal.set(false);
    this.scheduleTicketId.set(null);
    this.dateToVisit.set(null);
    this.targetCompletionDate.set(null);
    this.scheduleComment.set('');
  }

  /**
   * Confirm schedule visit
   */
  confirmSchedule(): void {
    const ticketId = this.scheduleTicketId();
    const visitDate = this.dateToVisit();
    const completionDate = this.targetCompletionDate();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    if (!visitDate) {
      this.message.warning('Please select a date to visit');
      return;
    }

    if (!completionDate) {
      this.message.warning('Please select a target completion date');
      return;
    }

    this.loading.set(true);
    this.ticketService.scheduleVisit(
      ticketId,
      visitDate.toISOString(),
      completionDate.toISOString(),
      this.scheduleComment() || undefined
    ).subscribe({
      next: () => {
        this.message.success('Visit scheduled! Waiting for admin acknowledgment.');
        this.closeScheduleModal();
        this.loadTickets();
      },
      error: (err) => {
        console.error('Failed to schedule visit:', err);
        this.message.error(err?.message || 'Failed to schedule visit');
        this.loading.set(false);
      },
    });
  }

  // ========================================
  // ACKNOWLEDGE SCHEDULE METHODS (for Admin)
  // ========================================

  /**
   * Open acknowledge schedule modal
   */
  openAcknowledgeModal(ticketId: number): void {
    this.acknowledgeTicketId.set(ticketId);
    this.acknowledgeAction.set('acknowledge');
    this.acknowledgeComment.set('');
    this.rejectReason.set('');
    this.showAcknowledgeModal.set(true);
  }

  /**
   * Close acknowledge schedule modal
   */
  closeAcknowledgeModal(): void {
    this.showAcknowledgeModal.set(false);
    this.acknowledgeTicketId.set(null);
    this.acknowledgeComment.set('');
    this.rejectReason.set('');
  }

  /**
   * Confirm acknowledge or reject schedule
   */
  confirmAcknowledge(): void {
    const ticketId = this.acknowledgeTicketId();
    const action = this.acknowledgeAction();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    this.loading.set(true);

    if (action === 'acknowledge') {
      this.ticketService.acknowledgeSchedule(ticketId, this.acknowledgeComment() || undefined).subscribe({
        next: () => {
          this.message.success('Schedule acknowledged! The user will be notified of the visit date.');
          this.closeAcknowledgeModal();
          this.loadTickets();
        },
        error: (err) => {
          console.error('Failed to acknowledge schedule:', err);
          this.message.error(err?.message || 'Failed to acknowledge schedule');
          this.loading.set(false);
        },
      });
    } else {
      const reason = this.rejectReason().trim();
      if (!reason) {
        this.message.warning('Please provide a reason for rejecting the schedule');
        this.loading.set(false);
        return;
      }

      this.ticketService.rejectSchedule(ticketId, reason).subscribe({
        next: () => {
          this.message.success('Schedule rejected. The department head will be notified.');
          this.closeAcknowledgeModal();
          this.loadTickets();
        },
        error: (err) => {
          console.error('Failed to reject schedule:', err);
          this.message.error(err?.message || 'Failed to reject schedule');
          this.loading.set(false);
        },
      });
    }
  }

  // ========================================
  // MONITOR NOTES METHODS (for Department Heads)
  // ========================================

  /**
   * Open monitor notes modal
   */
  openMonitorModal(ticketId: number): void {
    this.monitorTicketId.set(ticketId);
    this.monitorNotes.set('');
    this.recommendations.set('');
    this.monitorComment.set('');
    this.showMonitorModal.set(true);
  }

  /**
   * Close monitor notes modal
   */
  closeMonitorModal(): void {
    this.showMonitorModal.set(false);
    this.monitorTicketId.set(null);
    this.monitorNotes.set('');
    this.recommendations.set('');
    this.monitorComment.set('');
  }

  /**
   * Confirm add monitor notes and recommendations
   */
  confirmMonitor(): void {
    const ticketId = this.monitorTicketId();
    const notes = this.monitorNotes().trim();
    const recs = this.recommendations().trim();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    if (!notes) {
      this.message.warning('Please enter monitor notes');
      return;
    }

    if (!recs) {
      this.message.warning('Please enter recommendations');
      return;
    }

    this.loading.set(true);
    this.ticketService.addMonitorAndRecommendations(
      ticketId,
      notes,
      recs,
      this.monitorComment() || undefined
    ).subscribe({
      next: () => {
        this.message.success('Monitor notes and recommendations added successfully!');
        this.closeMonitorModal();
        this.loadTickets();
      },
      error: (err) => {
        console.error('Failed to add monitor notes:', err);
        this.message.error(err?.message || 'Failed to add monitor notes');
        this.loading.set(false);
      },
    });
  }
}
