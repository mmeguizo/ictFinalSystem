import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
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
import { TicketService, TicketDetail } from '../../core/services/ticket.service';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail.page.html',
  styleUrls: ['./ticket-detail.page.scss'],
})
export class TicketDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketService = inject(TicketService);
  private readonly message = inject(NzMessageService);

  readonly loading = signal(true);
  readonly ticket = signal<TicketDetail | null>(null);
  readonly submittingNote = signal(false);
  readonly noteContent = signal('');
  readonly isInternalNote = signal(false);

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
        console.log('📅 createdAt:', ticket.createdAt, 'Type:', typeof ticket.createdAt);
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

  formatDate(dateString?: string | number | Date | null): string {
    // Return dash for null, undefined, or empty string
    if (!dateString) return '-';

    // Parse the date - handle ISO strings, timestamps, and Date objects
    const d = dateString instanceof Date ? dateString : new Date(dateString);

    // Check if date is valid by testing if getTime() returns NaN
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
    if (t.secretaryApprovedAt) current++;
    if (t.directorApprovedAt) current++;

    return { current, total: 2 };
  }

  isAwaitingSecretaryApproval(): boolean {
    const t = this.ticket();
    return t?.status === 'PENDING' && !t.secretaryApprovedAt;
  }

  isAwaitingDirectorApproval(): boolean {
    const t = this.ticket();
    return t?.status === 'SECRETARY_APPROVED' && !t.directorApprovedAt;
  }

  isFullyApproved(): boolean {
    const t = this.ticket();
    return !!(t?.secretaryApprovedAt && t?.directorApprovedAt);
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
}
