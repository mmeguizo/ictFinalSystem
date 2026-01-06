import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { TicketService, TicketDetail } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';
import { NzMessageService } from 'ng-zorro-antd/message';

@Component({
  selector: 'app-ticket-detail',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    NzCardModule,
    NzDescriptionsModule,
    NzTagModule,
    NzButtonModule,
    NzSpinModule,
    NzTimelineModule,
    NzDividerModule,
    NzEmptyModule,
    NzAlertModule,
    NzInputModule,
    NzCheckboxModule,
    NzFormModule,
    NzSelectModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail.page.html',
  styleUrls: ['./ticket-detail.page.scss'],
})
export class TicketDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketService = inject(TicketService);
  private readonly message = inject(NzMessageService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(true);
  readonly ticket = signal<TicketDetail | null>(null);
  readonly submittingNote = signal(false);
  readonly noteContent = signal('');
  readonly isInternalNote = signal(false);

  // Status update state
  readonly updatingStatus = signal(false);
  readonly showStatusModal = signal(false);
  readonly selectedStatus = signal('');
  readonly statusComment = signal('');

  // Reopen ticket state
  readonly showReopenModal = signal(false);
  readonly reopenDescription = signal('');
  readonly reopenComment = signal('');
  readonly reopening = signal(false);

  // Secretary Review state (for admin/secretary)
  readonly showSecretaryReviewModal = signal(false);
  readonly secretaryReviewComment = signal('');
  readonly secretaryReviewAction = signal<'approve' | 'reject'>('approve');
  readonly processingSecretaryReview = signal(false);

  // Director Approval state (for admin/director)
  readonly showDirectorApprovalModal = signal(false);
  readonly directorApprovalComment = signal('');
  readonly directorApprovalAction = signal<'approve' | 'disapprove'>('approve');
  readonly processingDirectorApproval = signal(false);

  // ========================================
  // ROLE CHECKS
  // ========================================

  /** Check if current user is admin */
  readonly isAdmin = computed(() => this.authService.isAdmin());

  /** Check if current user is secretary */
  readonly isSecretaryRole = computed(() => this.authService.isSecretary());

  /** Check if current user is director */
  readonly isDirectorRole = computed(() => this.authService.isDirector());

  /** Check if user can perform secretary review (admin or secretary, ticket status FOR_REVIEW) */
  readonly canReviewAsSecretary = computed(() => {
    const t = this.ticket();
    if (!t || t.status !== 'FOR_REVIEW') return false;
    return this.isAdmin() || this.isSecretaryRole();
  });

  /** Check if user can perform director approval (admin or director, ticket status REVIEWED) */
  readonly canApproveAsDirector = computed(() => {
    const t = this.ticket();
    if (!t || t.status !== 'REVIEWED') return false;
    return this.isAdmin() || this.isDirectorRole();
  });

  /** Check if current user is the creator of this ticket */
  readonly isMyTicket = computed(() => {
    const t = this.ticket();
    const userId = this.authService.currentUser()?.id;
    return t?.createdBy?.id === userId;
  });

  /** Check if ticket can be reopened (cancelled and user is creator) */
  readonly canReopenTicket = computed(() => {
    const t = this.ticket();
    return t?.status === 'CANCELLED' && this.isMyTicket();
  });

  /** Check if current user is assigned to this ticket */
  readonly isAssignedToMe = computed(() => {
    const t = this.ticket();
    const userId = this.authService.currentUser()?.id;
    if (!t || !userId) return false;
    return t.assignments?.some((a) => a.user.id === userId) ?? false;
  });

  /** Check if user is staff (Developer or Technical) */
  readonly isStaff = computed(() =>
    this.authService.isDeveloper() || this.authService.isTechnical()
  );

  /** Check if current user can view internal notes (staff members only) */
  readonly canViewInternalNotes = computed(() => {
    const role = this.authService.currentUser()?.role;
    const staffRoles = ['ADMIN', 'SECRETARY', 'DIRECTOR', 'DEVELOPER', 'TECHNICAL', 'MIS_HEAD', 'ITS_HEAD'];
    return role ? staffRoles.includes(role) : false;
  });

  /** Filtered notes - hide internal notes from regular users */
  readonly visibleNotes = computed(() => {
    const t = this.ticket();
    if (!t?.notes) return [];

    // Staff can see all notes, regular users only see non-internal notes
    if (this.canViewInternalNotes()) {
      return t.notes;
    }
    return t.notes.filter(note => !note.isInternal);
  });

  /** Check if user can add internal notes (staff only) */
  readonly canAddInternalNotes = computed(() => this.canViewInternalNotes());

  /** Check if user can update ticket status */
  readonly canUpdateStatus = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    // Staff can update if assigned to them and status allows updates
    const workableStatuses = ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];
    return this.isStaff() && this.isAssignedToMe() && workableStatuses.includes(t.status);
  });

  /** Status options for staff */
  readonly statusOptions = [
    { value: 'IN_PROGRESS', label: 'In Progress', color: 'processing', description: 'Start working on this ticket' },
    { value: 'ON_HOLD', label: 'On Hold', color: 'warning', description: 'Pause work - waiting for info/resources' },
    { value: 'RESOLVED', label: 'Resolved', color: 'success', description: 'Work completed - ready for closure' },
  ];

  ngOnInit(): void {
    const ticketNumber = this.route.snapshot.paramMap.get('ticketNumber');
    if (ticketNumber) {
      this.loadTicket(ticketNumber);
    } else {
      this.loading.set(false);
      this.message.error('Invalid ticket number');
    }
  }

  loadTicket(ticketNumber: string): void {
    this.loading.set(true);
    this.ticketService.getTicketByNumber(ticketNumber).subscribe({
      next: (ticket) => {
        console.log('🎫 Ticket data received:', ticket);
        console.log('� Notes count:', ticket.notes?.length || 0, 'Notes:', ticket.notes);
        console.log('📊 Status History count:', ticket.statusHistory?.length || 0, 'History:', ticket.statusHistory);
        console.log('�📅 createdAt:', ticket.createdAt, 'Type:', typeof ticket.createdAt);
        console.log('📅 dueDate:', ticket.dueDate, 'Type:', typeof ticket.dueDate);
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load ticket:', error);
        this.message.error('Failed to load ticket details');
        this.loading.set(false);
      },
    });
  }

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

  formatDate(dateString?: string | number | Date | null): string {
    // Return dash for null, undefined, or empty string
    if (!dateString) return '-';

    let d: Date;

    // Handle different input types
    if (dateString instanceof Date) {
      d = dateString;
    } else if (typeof dateString === 'number') {
      // Already a number (timestamp in milliseconds)
      d = new Date(dateString);
    } else if (typeof dateString === 'string') {
      // Check if it's a numeric string (timestamp)
      if (/^\d+$/.test(dateString)) {
        d = new Date(parseInt(dateString, 10));
      } else {
        // Try parsing as date string
        d = new Date(dateString);
      }
    } else {
      // Fallback
      d = new Date(dateString as any);
    }

    // Check if date is valid
    if (isNaN(d.getTime())) {
      console.warn('⚠️ Invalid date value:', dateString);
      return '-';
    }

    return d.toLocaleString();
  }

  formatDateShort(dateString?: string | number | Date | null): string {
    // Return dash for null, undefined, or empty string
    if (!dateString) return '-';

    // Parse the date - handle ISO strings, timestamps, and Date objects
    const d = dateString instanceof Date ? dateString : new Date(dateString);

    // Check if date is valid by testing if getTime() returns NaN
    if (isNaN(d.getTime())) {
      console.warn('⚠️ Invalid date value:', dateString);
      return '-';
    }

    return d.toLocaleDateString();
  }

  getApprovalProgress(): { current: number; total: number } {
    const t = this.ticket();
    if (!t) return { current: 0, total: 2 };

    let current = 0;
    if (t.secretaryReviewedAt) current++;
    if (t.directorApprovedAt) current++;

    return { current, total: 2 };
  }

  isAwaitingSecretaryReview(): boolean {
    const t = this.ticket();
    return t?.status === 'FOR_REVIEW' && !t.secretaryReviewedAt;
  }

  isAwaitingDirectorApproval(): boolean {
    const t = this.ticket();
    return t?.status === 'REVIEWED' && !t.directorApprovedAt;
  }

  isFullyApproved(): boolean {
    const t = this.ticket();
    return !!(t?.secretaryReviewedAt && t?.directorApprovedAt);
  }

  submitNote(): void {
    const content = this.noteContent().trim();
    if (!content) {
      this.message.warning('Please enter a note');
      return;
    }

    const ticket = this.ticket();
    if (!ticket) {
      this.message.error('Ticket not found');
      return;
    }

    this.submittingNote.set(true);
    this.ticketService
      .addTicketNote(ticket.id, {
        content,
        isInternal: this.isInternalNote(),
      })
      .subscribe({
        next: () => {
          this.message.success('Note added successfully');
          this.noteContent.set('');
          this.isInternalNote.set(false);
          // Reload ticket to show new note
          this.loadTicket(ticket.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to add note:', error);
          this.message.error('Failed to add note');
          this.submittingNote.set(false);
        },
        complete: () => {
          this.submittingNote.set(false);
        },
      });
  }

  // ========================================
  // STATUS UPDATE METHODS (for Staff)
  // ========================================

  /**
   * Open status update modal
   */
  openStatusModal(): void {
    const t = this.ticket();
    if (!t) return;
    this.selectedStatus.set(t.status);
    this.statusComment.set('');
    this.showStatusModal.set(true);
  }

  /**
   * Close status update modal
   */
  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedStatus.set('');
    this.statusComment.set('');
  }

  /**
   * Quick status update (e.g., Start Work button)
   */
  quickStatusUpdate(newStatus: string, comment?: string): void {
    const t = this.ticket();
    if (!t) return;

    this.updatingStatus.set(true);
    this.ticketService.updateStatus(t.id, newStatus, comment).subscribe({
      next: () => {
        this.message.success(`Status updated to ${newStatus.replace('_', ' ')}`);
        this.loadTicket(t.ticketNumber);
      },
      error: (error) => {
        console.error('Failed to update status:', error);
        this.message.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  /**
   * Confirm status update from modal
   */
  confirmStatusUpdate(): void {
    const t = this.ticket();
    const status = this.selectedStatus();
    const comment = this.statusComment();

    if (!t || !status) {
      this.message.warning('Please select a status');
      return;
    }

    this.updatingStatus.set(true);
    this.ticketService.updateStatus(t.id, status, comment || undefined).subscribe({
      next: () => {
        this.message.success(`Status updated to ${status.replace('_', ' ')}`);
        this.closeStatusModal();
        this.loadTicket(t.ticketNumber);
      },
      error: (error) => {
        console.error('Failed to update status:', error);
        this.message.error('Failed to update status');
        this.updatingStatus.set(false);
      },
    });
  }

  // ========================================
  // REOPEN TICKET METHODS (for rejected/cancelled tickets)
  // ========================================

  /**
   * Open the reopen ticket modal
   */
  openReopenModal(): void {
    const t = this.ticket();
    if (!t) return;
    // Pre-fill with existing description for editing
    this.reopenDescription.set(t.description || '');
    this.reopenComment.set('');
    this.showReopenModal.set(true);
  }

  /**
   * Close the reopen ticket modal
   */
  closeReopenModal(): void {
    this.showReopenModal.set(false);
    this.reopenDescription.set('');
    this.reopenComment.set('');
  }

  /**
   * Submit the reopened ticket
   */
  confirmReopenTicket(): void {
    const t = this.ticket();
    if (!t) return;

    const description = this.reopenDescription().trim();
    const comment = this.reopenComment().trim();

    this.reopening.set(true);
    this.ticketService
      .reopenTicket(t.id, {
        updatedDescription: description !== t.description ? description : undefined,
        comment: comment || undefined,
      })
      .subscribe({
        next: () => {
          this.message.success('Ticket reopened successfully! It will be reviewed again.');
          this.closeReopenModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to reopen ticket:', error);
          this.message.error(error.message || 'Failed to reopen ticket');
          this.reopening.set(false);
        },
        complete: () => {
          this.reopening.set(false);
        },
      });
  }

  // ========================================
  // SECRETARY REVIEW METHODS (for Admin/Secretary)
  // ========================================

  /**
   * Open secretary review modal
   */
  openSecretaryReviewModal(): void {
    this.secretaryReviewComment.set('');
    this.secretaryReviewAction.set('approve');
    this.showSecretaryReviewModal.set(true);
  }

  /**
   * Close secretary review modal
   */
  closeSecretaryReviewModal(): void {
    this.showSecretaryReviewModal.set(false);
    this.secretaryReviewComment.set('');
    this.secretaryReviewAction.set('approve');
  }

  /**
   * Confirm secretary review (approve or reject)
   */
  confirmSecretaryReview(): void {
    const t = this.ticket();
    if (!t) return;

    const action = this.secretaryReviewAction();
    const comment = this.secretaryReviewComment().trim();

    if (action === 'reject' && !comment) {
      this.message.warning('Please provide a reason for rejecting the ticket');
      return;
    }

    this.processingSecretaryReview.set(true);

    if (action === 'approve') {
      this.ticketService.reviewAsSecretary(t.id, comment || undefined).subscribe({
        next: () => {
          this.message.success('Ticket reviewed and forwarded for director approval!');
          this.closeSecretaryReviewModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to review ticket:', error);
          this.message.error('Failed to review ticket');
          this.processingSecretaryReview.set(false);
        },
        complete: () => {
          this.processingSecretaryReview.set(false);
        },
      });
    } else {
      this.ticketService.rejectAsSecretary(t.id, comment).subscribe({
        next: () => {
          this.message.success('Ticket returned to requester with notes');
          this.closeSecretaryReviewModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to reject ticket:', error);
          this.message.error(error?.message || 'Failed to reject ticket');
          this.processingSecretaryReview.set(false);
        },
        complete: () => {
          this.processingSecretaryReview.set(false);
        },
      });
    }
  }

  // ========================================
  // DIRECTOR APPROVAL METHODS (for Admin/Director)
  // ========================================

  /**
   * Open director approval modal
   */
  openDirectorApprovalModal(): void {
    this.directorApprovalComment.set('');
    this.directorApprovalAction.set('approve');
    this.showDirectorApprovalModal.set(true);
  }

  /**
   * Close director approval modal
   */
  closeDirectorApprovalModal(): void {
    this.showDirectorApprovalModal.set(false);
    this.directorApprovalComment.set('');
    this.directorApprovalAction.set('approve');
  }

  /**
   * Confirm director approval (approve or disapprove)
   */
  confirmDirectorApproval(): void {
    const t = this.ticket();
    if (!t) return;

    const action = this.directorApprovalAction();
    const comment = this.directorApprovalComment().trim();

    if (action === 'disapprove' && !comment) {
      this.message.warning('Please provide a reason for disapproving the ticket');
      return;
    }

    this.processingDirectorApproval.set(true);

    if (action === 'approve') {
      this.ticketService.approveAsDirector(t.id, comment || undefined).subscribe({
        next: () => {
          this.message.success('Ticket approved and auto-assigned to Office Head!');
          this.closeDirectorApprovalModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to approve ticket:', error);
          this.message.error('Failed to approve ticket');
          this.processingDirectorApproval.set(false);
        },
        complete: () => {
          this.processingDirectorApproval.set(false);
        },
      });
    } else {
      this.ticketService.disapproveAsDirector(t.id, comment).subscribe({
        next: () => {
          this.message.success('Ticket disapproved and returned to requester');
          this.closeDirectorApprovalModal();
          this.loadTicket(t.ticketNumber);
        },
        error: (error) => {
          console.error('Failed to disapprove ticket:', error);
          this.message.error(error?.message || 'Failed to disapprove ticket');
          this.processingDirectorApproval.set(false);
        },
        complete: () => {
          this.processingDirectorApproval.set(false);
        },
      });
    }
  }
}
