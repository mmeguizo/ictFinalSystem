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

  // Check if user is admin/director (can see all tickets with secretary approval status)
  readonly isAdminOrDirector = computed(() =>
    this.authService.isAdmin() || this.authService.isDirector() || this.authService.isOfficeHead()
  );

  readonly isSecretary = computed(() =>
    this.authService.isSecretary()
  );

  // Count tickets NOT approved by secretary yet (no secretaryApprovedAt)
  readonly pendingCount = computed(() =>
    this.tickets().filter(t => !t.secretaryApprovedAt).length
  );

  // Count tickets approved by secretary (has secretaryApprovedAt)
  readonly approvedCount = computed(() =>
    this.tickets().filter(t => !!t.secretaryApprovedAt).length
  );

  readonly filteredTickets = computed(() => {
    const filter = this.statusFilter();
    const allTickets = this.tickets();

    if (filter === 'ALL') {
      return allTickets;
    }

    // Filter based on secretary approval status
    if (filter === 'PENDING') {
      return allTickets.filter((t) => !t.secretaryApprovedAt);
    }
    if (filter === 'APPROVED') {
      return allTickets.filter((t) => !!t.secretaryApprovedAt);
    }

    return allTickets;
  });

  ngOnInit(): void {
    this.loadTicketsForApproval();
  }

  loadTicketsForApproval(): void {
    this.loading.set(true);

    // Admin/Director sees all secretary tickets (pending + approved)
    // Secretary sees only pending tickets
    const ticketQuery = this.isAdminOrDirector()
      ? this.ticketService.getAllSecretaryTickets()
      : this.ticketService.getTicketsPendingSecretaryApproval();

    ticketQuery.subscribe({
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

  approveTicket(ticketId: number): void {
    this.loading.set(true);
    this.ticketService.approveAsSecretary(ticketId).subscribe({
      next: () => {
        this.message.success('Ticket approved successfully!');
        this.loadTicketsForApproval(); // Refresh the list
      },
      error: (err) => {
        console.error('Failed to approve ticket:', err);
        this.message.error('Failed to approve ticket.');
        this.loading.set(false);
      },
    });
  }

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      PENDING: 'gold',
      SECRETARY_APPROVED: 'blue',
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
