import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-tickets.page.html',
  styleUrls: ['./my-tickets.page.scss'],
})
export class MyTicketsPage implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly message = inject(NzMessageService);
  private readonly authService = inject(AuthService);

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
  readonly isStaff = computed(() =>
    this.authService.isDeveloper() || this.authService.isTechnical()
  );

  /** Check if user is admin */
  readonly isAdmin = computed(() => this.authService.isAdmin());

  /** Check if user can view all tickets (admin, heads, secretary) */
  readonly canViewAllTickets = computed(() =>
    this.authService.isAdmin() || this.authService.isOfficeHead() || this.authService.isSecretary()
  );

  /** Check if user can create tickets (USER and SECRETARY roles) */
  readonly canCreateTicket = computed(() =>
    this.authService.isSecretary() || this.authService.isUser()
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

  ngOnInit(): void {
    this.loadTickets();

    // Load staff list if user is a department head
    if (this.isDepartmentHead()) {
      this.loadStaffList();
    }
  }

  /**
   * Load tickets based on user role
   */
  loadTickets(): void {
    this.loading.set(true);

    let ticketQuery;

    if (this.isAdmin() || this.authService.isSecretary()) {
      // Admin/Secretary sees all tickets
      ticketQuery = this.ticketService.getAllTickets();
    } else if (this.isDepartmentHead() || this.isStaff()) {
      // Department heads and staff see their assigned tickets
      ticketQuery = this.ticketService.getMyAssignedTickets();
    } else {
      // Regular users see tickets they created
      ticketQuery = this.ticketService.getMyCreatedTickets();
    }

    ticketQuery.subscribe({
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
    return ticket.assignments?.some(a => a.user.id === currentUserId) ?? false;
  }
}
