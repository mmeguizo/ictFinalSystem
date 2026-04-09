import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormsModule } from '@angular/forms';
import { TicketService, TicketListItem } from '../../core/services/ticket.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';

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
    NzIconModule,
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
  private readonly realtimeService = inject(RealtimeService);

  constructor() {
    // Real-time: auto-refresh table when WebSocket events arrive
    effect(() => {
      const created = this.realtimeService.lastTicketCreated();
      if (created) {
        this.silentRefresh();
      }
    });

    effect(() => {
      const changed = this.realtimeService.lastStatusChange();
      if (changed) {
        this.silentRefresh();
      }
    });

    effect(() => {
      const notif = this.realtimeService.lastNotification();
      if (notif) {
        this.silentRefresh();
      }
    });
  }

  readonly loading = signal(false);
  readonly tickets = signal<TicketListItem[]>([]);
  readonly statusFilter = signal<string>('ALL');

  // Staff list for assignment dropdown (populated for MIS_HEAD/ITS_HEAD)
  readonly staffList = signal<{ id: number; name: string; email: string; role: string }[]>([]);

  // Modal state for assignment (includes optional schedule dates)
  readonly showAssignModal = signal(false);
  readonly selectedTicketId = signal<number | null>(null);
  readonly selectedUserId = signal<number | null>(null);
  // Optional dates that head can set during assignment (not required)
  readonly assignDateToVisit = signal<Date | null>(null);
  readonly assignTargetCompletion = signal<Date | null>(null);
  readonly assignComment = signal<string>('');

  // Modal state for status update (for developers)
  readonly showStatusModal = signal(false);
  readonly selectedStatus = signal<string>('');
  readonly statusComment = signal<string>('');
  readonly statusTargetCompletionDate = signal<Date | null>(null); // Developer sets target completion
  // Modal state for secretary review (for Admin)
  readonly showReviewModal = signal(false);
  readonly reviewTicketId = signal<number | null>(null);
  readonly reviewComment = signal<string>('');
  readonly reviewAction = signal<'approve' | 'reject'>('approve');

  // Modal state for head acknowledge & assign developer (for Department Heads)
  readonly showHeadAcknowledgeModal = signal(false);
  readonly headAckTicketId = signal<number | null>(null);
  readonly headAckDeveloperName = signal<string>('');
  readonly headAckDateToVisit = signal<Date | null>(null);
  readonly headAckTargetCompletion = signal<Date | null>(null);
  readonly headAckComment = signal<string>('');

  // Modal state for resolution update (for Department Heads)
  readonly showResolutionModal = signal(false);
  readonly resolutionTicketId = signal<number | null>(null);
  readonly resolutionText = signal<string>('');
  readonly resolutionDateFinished = signal<Date | null>(null);
  readonly resolutionComment = signal<string>('');

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
    () => this.authService.isDeveloper() || this.authService.isTechnical(),
  );

  /** Check if user is admin */
  readonly isAdmin = computed(() => this.authService.isAdmin());

  /** Check if user is secretary */
  readonly isSecretary = computed(() => this.authService.isSecretary());

  /** Check if user is director */
  readonly isDirector = computed(() => this.authService.isDirector());

  /** Check if user can review as secretary (admin or secretary) */
  readonly canReviewAsSecretary = computed(
    () => this.authService.isAdmin() || this.authService.isSecretary(),
  );

  /** Check if user can view all tickets (admin, heads, secretary) */
  readonly canViewAllTickets = computed(
    () =>
      this.authService.isAdmin() ||
      this.authService.isOfficeHead() ||
      this.authService.isSecretary(),
  );

  /** Check if user can create tickets (USER and SECRETARY roles) */
  readonly canCreateTicket = computed(
    () => this.authService.isSecretary() || this.authService.isUser(),
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
    () => this.tickets().filter((t) => t.status === 'FOR_REVIEW').length,
  );

  /** Count of reviewed tickets */
  readonly reviewedCount = computed(
    () => this.tickets().filter((t) => t.status === 'REVIEWED').length,
  );

  /** Count of director approved tickets */
  readonly directorApprovedCount = computed(
    () => this.tickets().filter((t) => t.status === 'DIRECTOR_APPROVED').length,
  );

  /** Count of assigned tickets */
  readonly assignedCount = computed(
    () => this.tickets().filter((t) => t.status === 'ASSIGNED').length,
  );

  /** Count of pending tickets */
  readonly pendingCount = computed(
    () => this.tickets().filter((t) => t.status === 'PENDING').length,
  );

  /** Count of in progress tickets */
  readonly inProgressCount = computed(
    () => this.tickets().filter((t) => t.status === 'IN_PROGRESS').length,
  );

  /** Count of on hold tickets */
  readonly onHoldCount = computed(
    () => this.tickets().filter((t) => t.status === 'ON_HOLD').length,
  );

  /** Count of resolved tickets */
  readonly resolvedCount = computed(
    () => this.tickets().filter((t) => t.status === 'RESOLVED').length,
  );

  /** Count of closed tickets */
  readonly closedCount = computed(() => this.tickets().filter((t) => t.status === 'CLOSED').length);

  /** Count of cancelled tickets */
  readonly cancelledCount = computed(
    () => this.tickets().filter((t) => t.status === 'CANCELLED').length,
  );

  /** Recent tickets (last 10) sorted by creation date */
  readonly recentTickets = computed(() =>
    [...this.tickets()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
  );

  ngOnInit(): void {
    this.loadTickets();

    // Load staff list if user is a department head or admin
    if (this.isDepartmentHead() || this.isAdmin()) {
      this.loadStaffList();
    }

    // Set up auto-refresh polling every 60 seconds (fallback for missed WS events)
    interval(60000)
      .pipe(
        switchMap(() => this.getTicketQuery()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tickets) => {
          this.tickets.set(tickets);
        },
        error: (error) => {
          console.error('Auto-refresh failed:', error);
        },
      });
  }

  /** Silently refresh the ticket list without showing loading spinner */
  private silentRefresh(): void {
    this.getTicketQuery().subscribe({
      next: (tickets) => this.tickets.set(tickets),
      error: (err) => console.error('Silent refresh failed:', err),
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
    if (this.isAdmin()) {
      // Admin can assign any DEVELOPER or TECHNICAL staff
      this.ticketService.getUsersByRoles(['DEVELOPER', 'TECHNICAL']).subscribe({
        next: (users) => this.staffList.set(users),
        error: (error) => {
          console.error('Failed to load staff list:', error);
          this.message.error('Failed to load staff list');
        },
      });
    } else {
      const role = this.isMISHead() ? 'DEVELOPER' : 'TECHNICAL';
      this.ticketService.getUsersByRole(role).subscribe({
        next: (users) => this.staffList.set(users),
        error: (error) => {
          console.error('Failed to load staff list:', error);
          this.message.error('Failed to load staff list');
        },
      });
    }
  }

  // ========================================
  // ASSIGNMENT METHODS (for Department Heads)
  // ========================================

  /**
   * Open assignment modal for a ticket
   * Resets all fields including optional dates
   */
  openAssignModal(ticketId: number): void {
    this.selectedTicketId.set(ticketId);
    this.selectedUserId.set(null);
    this.assignDateToVisit.set(null);
    this.assignTargetCompletion.set(null);
    this.assignComment.set('');
    this.showAssignModal.set(true);
  }

  /**
   * Close assignment modal and reset all fields
   */
  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.selectedTicketId.set(null);
    this.selectedUserId.set(null);
    this.assignDateToVisit.set(null);
    this.assignTargetCompletion.set(null);
    this.assignComment.set('');
  }

  /**
   * Assign ticket to selected staff member
   * Optionally includes dateToVisit and targetCompletionDate (not required)
   */
  confirmAssignment(): void {
    const ticketId = this.selectedTicketId();
    const userId = this.selectedUserId();
    const dateToVisit = this.assignDateToVisit();

    if (!ticketId || !userId) {
      this.message.warning('Please select a staff member');
      return;
    }

    if (!dateToVisit) {
      this.message.warning('Please select a date to visit');
      return;
    }

    // Date to visit is required - this triggers assign + schedule in one step
    const options = {
      dateToVisit: dateToVisit.toISOString(),
    };

    this.loading.set(true);
    this.ticketService.assignTicketToUser(ticketId, userId, options).subscribe({
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
   * Pre-populates the target completion date if ticket already has one
   */
  openStatusModal(ticketId: number, currentStatus: string, existingTargetDate?: string): void {
    this.selectedTicketId.set(ticketId);
    this.selectedStatus.set(currentStatus);
    this.statusComment.set('');
    // Pre-load existing target completion date if available
    this.statusTargetCompletionDate.set(existingTargetDate ? new Date(existingTargetDate) : null);
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
    this.statusTargetCompletionDate.set(null);
  }

  /**
   * Update ticket status
   * Developer can also set/update targetCompletionDate
   */
  confirmStatusUpdate(): void {
    const ticketId = this.selectedTicketId();
    const status = this.selectedStatus();

    if (!ticketId || !status) {
      this.message.warning('Please select a status');
      return;
    }

    // Get optional target completion date
    const targetDate = this.statusTargetCompletionDate();
    const targetDateStr = targetDate ? targetDate.toISOString() : undefined;

    this.loading.set(true);
    this.ticketService
      .updateStatus(ticketId, status, this.statusComment() || undefined, targetDateStr)
      .subscribe({
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
      PENDING: 'orange',
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

  formatDate(dateString?: string | number | Date | null): string {
    if (!dateString) return '-';

    let d: Date;

    if (dateString instanceof Date) {
      d = dateString;
    } else if (typeof dateString === 'number') {
      d = new Date(dateString);
    } else if (typeof dateString === 'string') {
      // Support numeric timestamp strings
      d = /^\d+$/.test(dateString) ? new Date(parseInt(dateString, 10)) : new Date(dateString);
    } else {
      d = new Date(dateString as any);
    }

    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
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
    // Only MIS_HEAD and ITS_HEAD can assign (not admin)
    if (!this.isDepartmentHead()) return false;
    if (ticket.status !== 'ASSIGNED' && ticket.status !== 'DIRECTOR_APPROVED') return false;

    // Check if any staff (DEVELOPER or TECHNICAL) is already assigned
    const hasStaffAssigned = ticket.assignments?.some(
      (a) => a.user.role === 'DEVELOPER' || a.user.role === 'TECHNICAL',
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
    return (
      (this.isAdmin() || this.isDirector() || this.isDepartmentHead()) &&
      ticket.status === 'REVIEWED' &&
      !ticket.directorApprovedAt
    );
  }

  /**
   * Check if ticket can be acknowledged & assigned a developer by department head
   * (Head acknowledges ASSIGNED ticket and enters developer name)
   */
  canHeadAcknowledge(ticket: TicketListItem): boolean {
    if (!this.isDepartmentHead()) return false;
    return ticket.status === 'ASSIGNED';
  }

  /**
   * Check if ticket can have resolution updated by department head
   * (After work is done - PENDING, IN_PROGRESS, ON_HOLD, RESOLVED statuses)
   */
  canUpdateResolution(ticket: TicketListItem): boolean {
    if (!this.isDepartmentHead()) return false;
    const allowedStatuses = ['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'];
    return allowedStatuses.includes(ticket.status);
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
  // HEAD ACKNOWLEDGE & ASSIGN DEVELOPER (for Department Heads)
  // ========================================

  /**
   * Open head acknowledge modal
   */
  openHeadAcknowledgeModal(ticketId: number): void {
    this.headAckTicketId.set(ticketId);
    this.headAckDeveloperName.set('');
    this.headAckDateToVisit.set(null);
    this.headAckTargetCompletion.set(null);
    this.headAckComment.set('');
    this.showHeadAcknowledgeModal.set(true);
  }

  /**
   * Close head acknowledge modal
   */
  closeHeadAcknowledgeModal(): void {
    this.showHeadAcknowledgeModal.set(false);
    this.headAckTicketId.set(null);
    this.headAckDeveloperName.set('');
    this.headAckDateToVisit.set(null);
    this.headAckTargetCompletion.set(null);
    this.headAckComment.set('');
  }

  /**
   * Confirm head acknowledge and assign developer
   */
  confirmHeadAcknowledge(): void {
    const ticketId = this.headAckTicketId();
    const developerName = this.headAckDeveloperName().trim();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    if (!developerName) {
      this.message.warning('Please enter the developer name');
      return;
    }

    const input: any = {
      assignedDeveloperName: developerName,
    };

    const dateToVisit = this.headAckDateToVisit();
    if (dateToVisit) {
      input.dateToVisit = dateToVisit.toISOString();
    }

    const targetCompletion = this.headAckTargetCompletion();
    if (targetCompletion) {
      input.targetCompletionDate = targetCompletion.toISOString();
    }

    const comment = this.headAckComment().trim();
    if (comment) {
      input.comment = comment;
    }

    this.loading.set(true);
    this.ticketService.acknowledgeAndAssignDeveloper(ticketId, input).subscribe({
      next: () => {
        this.message.success('Ticket acknowledged and developer assigned!');
        this.closeHeadAcknowledgeModal();
        this.loadTickets();
      },
      error: (err) => {
        console.error('Failed to acknowledge ticket:', err);
        this.message.error(err?.message || 'Failed to acknowledge ticket');
        this.loading.set(false);
      },
    });
  }

  // ========================================
  // RESOLUTION UPDATE (for Department Heads)
  // ========================================

  /**
   * Open resolution update modal
   */
  openResolutionModal(ticketId: number, existingResolution?: string): void {
    this.resolutionTicketId.set(ticketId);
    this.resolutionText.set(existingResolution || '');
    this.resolutionDateFinished.set(null);
    this.resolutionComment.set('');
    this.showResolutionModal.set(true);
  }

  /**
   * Close resolution modal
   */
  closeResolutionModal(): void {
    this.showResolutionModal.set(false);
    this.resolutionTicketId.set(null);
    this.resolutionText.set('');
    this.resolutionDateFinished.set(null);
    this.resolutionComment.set('');
  }

  /**
   * Confirm resolution update
   */
  confirmResolution(): void {
    const ticketId = this.resolutionTicketId();
    const resolution = this.resolutionText().trim();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    if (!resolution) {
      this.message.warning('Please enter a resolution');
      return;
    }

    const input: any = {
      resolution,
    };

    const dateFinished = this.resolutionDateFinished();
    if (dateFinished) {
      input.dateFinished = dateFinished.toISOString();
    }

    const comment = this.resolutionComment().trim();
    if (comment) {
      input.comment = comment;
    }

    this.loading.set(true);
    this.ticketService.updateResolution(ticketId, input).subscribe({
      next: () => {
        this.message.success('Resolution updated successfully!');
        this.closeResolutionModal();
        this.loadTickets();
      },
      error: (err) => {
        console.error('Failed to update resolution:', err);
        this.message.error(err?.message || 'Failed to update resolution');
        this.loading.set(false);
      },
    });
  }
}
