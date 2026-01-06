import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { TicketService, TicketListItem } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-secretary-approval-page',
  standalone: true,
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
    NzBadgeModule,
    NzToolTipModule,
    NzModalModule,
    NzInputModule,
  ],
  templateUrl: './secretary-approval.page.html',
  styleUrls: ['./secretary-approval.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryApprovalPage implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly message = inject(NzMessageService);
  private readonly authService = inject(AuthService);

  readonly loading = signal(false);
  readonly tickets = signal<TicketListItem[]>([]);
  readonly statusFilter = signal<string>('ALL');

  // Disapprove modal state (for Director)
  readonly showDisapproveModal = signal(false);
  readonly selectedTicketId = signal<number | null>(null);
  readonly disapproveReason = signal('');

  // Review modal state (for Secretary - with optional comment)
  readonly showReviewModal = signal(false);
  readonly reviewTicketId = signal<number | null>(null);
  readonly reviewComment = signal('');
  readonly reviewAction = signal<'approve' | 'reject'>('approve');

  // Check if user is admin/director (can approve/disapprove)
  readonly isAdminOrDirector = computed(() =>
    this.authService.isAdmin() || this.authService.isDirector()
  );

  // Check if user is office head (MIS/ITS head)
  readonly isOfficeHead = computed(() =>
    this.authService.isOfficeHead()
  );

  readonly isSecretary = computed(() =>
    this.authService.isSecretary()
  );

  // Count tickets NOT reviewed by secretary yet (no secretaryReviewedAt)
  readonly pendingCount = computed(() =>
    this.tickets().filter(t => !t.secretaryReviewedAt).length
  );

  // Count tickets reviewed by secretary (has secretaryReviewedAt)
  readonly reviewedCount = computed(() =>
    this.tickets().filter(t => !!t.secretaryReviewedAt && t.status !== 'CANCELLED').length
  );

  // Count rejected tickets
  readonly rejectedCount = computed(() =>
    this.tickets().filter(t => t.status === 'CANCELLED').length
  );

  readonly filteredTickets = computed(() => {
    const filter = this.statusFilter();
    const allTickets = this.tickets();

    if (filter === 'ALL') {
      return allTickets;
    }

    // Filter based on secretary review status
    if (filter === 'FOR_REVIEW') {
      return allTickets.filter((t) => !t.secretaryReviewedAt && t.status !== 'CANCELLED');
    }
    if (filter === 'REVIEWED') {
      return allTickets.filter((t) => !!t.secretaryReviewedAt && t.status !== 'CANCELLED');
    }
    if (filter === 'CANCELLED') {
      return allTickets.filter((t) => t.status === 'CANCELLED');
    }

    return allTickets;
  });

  ngOnInit(): void {
    this.loadTicketsForApproval();
  }

  loadTicketsForApproval(): void {
    this.loading.set(true);

    // Secretary and Admin/Director should see all secretary-related tickets (FOR_REVIEW + REVIEWED)
    // This ensures tickets don't disappear after review
    this.ticketService.getAllSecretaryTickets().subscribe({
      next: (tickets) => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tickets for approval:', error);
        this.message.error('Failed to load tickets for approval');
        this.loading.set(false);
      },
    });
  }

  // ========================================
  // SECRETARY REVIEW METHODS
  // ========================================

  /**
   * Open review modal for secretary
   */
  openReviewModal(ticketId: number): void {
    this.reviewTicketId.set(ticketId);
    this.reviewAction.set('approve'); // Default to approve, user can change via buttons
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
      this.ticketService.reviewAsSecretary(ticketId, comment || undefined).subscribe({
        next: () => {
          this.message.success('Ticket reviewed and forwarded for director approval!');
          this.closeReviewModal();
          this.loadTicketsForApproval();
        },
        error: (err) => {
          console.error('Failed to review ticket:', err);
          this.message.error('Failed to review ticket');
          this.loading.set(false);
        },
      });
    } else {
      // Reject: Return to user with comment
      console.log('Rejecting ticket:', ticketId, 'with reason:', comment);
      this.ticketService.rejectAsSecretary(ticketId, comment).subscribe({
        next: (result) => {
          console.log('Rejection result:', result);
          this.message.success('Ticket returned to requester with comments');
          this.closeReviewModal();
          this.loadTicketsForApproval();
        },
        error: (err) => {
          console.error('Failed to reject ticket:', err);
          this.message.error(err?.message || 'Failed to reject ticket');
          this.loading.set(false);
        },
      });
    }
  }

  /**
   * Quick review without modal (just approve)
   */
  reviewTicket(ticketId: number): void {
    this.loading.set(true);
    this.ticketService.reviewAsSecretary(ticketId).subscribe({
      next: () => {
        this.message.success('Ticket reviewed successfully!');
        this.loadTicketsForApproval(); // Refresh the list
      },
      error: (err) => {
        console.error('Failed to review ticket:', err);
        this.message.error('Failed to review ticket.');
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

  /**
   * Approve ticket as director/admin
   * This will approve the ticket and auto-assign to the appropriate office head
   */
  approveAsDirector(ticketId: number): void {
    this.loading.set(true);
    this.ticketService.approveAsDirector(ticketId).subscribe({
      next: () => {
        this.message.success('Ticket approved and auto-assigned to Office Head!');
        this.loadTicketsForApproval(); // Refresh the list
      },
      error: (err) => {
        console.error('Failed to approve ticket:', err);
        this.message.error('Failed to approve ticket.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Open disapprove modal
   */
  openDisapproveModal(ticketId: number): void {
    this.selectedTicketId.set(ticketId);
    this.disapproveReason.set('');
    this.showDisapproveModal.set(true);
  }

  /**
   * Close disapprove modal
   */
  closeDisapproveModal(): void {
    this.showDisapproveModal.set(false);
    this.selectedTicketId.set(null);
    this.disapproveReason.set('');
  }

  /**
   * Confirm disapproval with reason
   */
  confirmDisapprove(): void {
    const ticketId = this.selectedTicketId();
    const reason = this.disapproveReason().trim();

    if (!ticketId) {
      this.message.error('No ticket selected');
      return;
    }

    if (!reason) {
      this.message.warning('Please provide a reason for disapproval');
      return;
    }

    this.loading.set(true);
    this.ticketService.disapproveAsDirector(ticketId, reason).subscribe({
      next: () => {
        this.message.success('Ticket has been disapproved');
        this.closeDisapproveModal();
        this.loadTicketsForApproval();
      },
      error: (err) => {
        console.error('Failed to disapprove ticket:', err);
        this.message.error('Failed to disapprove ticket');
        this.loading.set(false);
      },
    });
  }

  /**
   * Check if ticket can be approved by director (must be reviewed by secretary first)
   */
  canApprove(ticket: TicketListItem): boolean {
    return !!ticket.secretaryReviewedAt && ticket.status === 'REVIEWED';
  }
}
